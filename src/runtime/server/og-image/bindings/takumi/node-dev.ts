import { Worker } from 'node:worker_threads'
import { createWorkerQueue, parseWorkerTimeout } from '../worker-queue'

// Worker maintains a persistent Renderer instance, which keeps decoded fonts
// between renders. Fonts and images are read on the main thread, where Nitro's
// fetch lives, and only when the renderer asks for them.
const workerCode = `
const { createRequire } = require('node:module')
const _require = createRequire(process.cwd() + '/')
const { parentPort } = require('node:worker_threads')
const { Renderer } = _require('@takumi-rs/core')

const renderer = new Renderer()
const pendingReads = new Map()
let readId = 0

function readFromMain(id, kind, key) {
  return new Promise((resolve, reject) => {
    pendingReads.set(++readId, { resolve, reject })
    parentPort.postMessage({ _tag: 'read', id, readId, kind, key })
  })
}

parentPort.on('message', async (message) => {
  if (message.type === 'read-result') {
    const pending = pendingReads.get(message.readId)
    pendingReads.delete(message.readId)
    if (message.error)
      pending.reject(new Error(message.error))
    else
      pending.resolve(message.data)
    return
  }
  const { id, nodes, layout, fonts, images, format } = message
  try {
    const prepared = await renderer.prepare(nodes, {
      ...layout,
      fonts: fonts.map(font => ({ ...font, data: () => readFromMain(id, 'font', font.key) })),
      images: { sources: images, fetch: async src => new Response(await readFromMain(id, 'image', src)), throwOnError: false },
    })
    const image = await renderer.render(prepared, { format })
    // Always slice to create a standard ArrayBuffer — native addon buffers
    // use external memory that can't be transferred via postMessage
    const ab = image.buffer.slice(image.byteOffset, image.byteOffset + image.byteLength)
    parentPort.postMessage({ _tag: 'response', id, payload: { _tag: 'success', image: ab } }, [ab])
  } catch (err) {
    parentPort.postMessage({ _tag: 'response', id, payload: { _tag: 'failure', error: err?.message || String(err) } })
  }
})
parentPort.postMessage({ _tag: 'ready' })
`

interface FontLoader {
  key: string
  name: string
  data: () => Promise<Uint8Array>
  weight?: number
  style?: string
  unicodeRange?: [number, number][]
}

interface ImageSource {
  src: string
  data: Uint8Array
}

interface PrepareOptions {
  width: number
  height: number
  devicePixelRatio: number
  fontFamilies: string[]
  fonts: FontLoader[]
  images: {
    sources: ImageSource[]
    fetch: (src: string) => Promise<Response>
    allowUrl: (src: string) => boolean
  }
}

interface RenderMessage {
  id: number
  nodes: unknown
  layout: Omit<PrepareOptions, 'fonts' | 'images'>
  fonts: Array<Omit<FontLoader, 'data'>>
  images: ImageSource[]
  format: 'png' | 'jpeg' | 'webp'
}

type RenderResponse
  = { _tag: 'success', image: ArrayBuffer }
    | { _tag: 'failure', error: string }

interface ReadRequest {
  _tag: 'read'
  id: number
  readId: number
  kind: 'font' | 'image'
  key: string
}

interface PreparedSource {
  nodes: unknown
  options: PrepareOptions
}

// Queue wait does not consume the per-render budget. Worker startup has its
// own bound so native addon load failures cannot leave prerendering hung.
const workerTimeout = parseWorkerTimeout(process.env.NUXT_OG_IMAGE_WORKER_TIMEOUT)
const activeJobs = new Map<number, PrepareOptions>()
const workerQueue = createWorkerQueue<RenderMessage, RenderResponse>({
  createWorker: () => {
    const worker = new Worker(workerCode, { eval: true })
    worker.on('message', async (message: Partial<ReadRequest>) => {
      if (message._tag !== 'read')
        return
      const { id, readId, kind, key } = message as ReadRequest
      try {
        const options = activeJobs.get(id)
        if (kind === 'font') {
          const data = await options?.fonts.find(font => font.key === key)?.data()
          worker.postMessage({ type: 'read-result', readId, data })
          return
        }
        if (!options?.images.allowUrl(key)) {
          throw new Error(`Image ${key} is not allowed`)
        }
        const data = await (await options.images.fetch(key)).arrayBuffer()
        worker.postMessage({ type: 'read-result', readId, data }, [data])
      }
      catch (err) {
        worker.postMessage({ type: 'read-result', readId, error: (err as Error).message })
      }
    })
    return worker
  },
  executionTimeout: workerTimeout,
  startupTimeout: workerTimeout,
  label: 'takumi',
})

// Clean up worker on process exit — avoid SIGINT/SIGTERM signal handlers because
// they keep the event loop alive and prevent exit after prerendering completes.
// Use Symbol.for guard to prevent duplicate listeners on HMR re-imports.
const signalKey = Symbol.for('og-image:takumi-worker-cleanup')
if (!(globalThis as any)[signalKey]) {
  (globalThis as any)[signalKey] = true
  process.on('exit', workerQueue.shutdown)
}

// Proxy class matching the Renderer interface but delegating to the worker.
class RendererWorkerProxy {
  async prepare(nodes: unknown, options: PrepareOptions): Promise<PreparedSource> {
    return { nodes, options }
  }

  async render({ nodes, options }: PreparedSource, { format }: { format: RenderMessage['format'] }): Promise<Buffer> {
    const { fonts, images, ...layout } = options
    let jobId: number | undefined
    const result = await workerQueue.enqueue(({ id }) => {
      jobId = id
      activeJobs.set(id, options)
      return { id, nodes, layout, fonts: fonts.map(({ data, ...font }) => font), images: images.sources, format }
    }).finally(() => {
      if (jobId !== undefined) {
        activeJobs.delete(jobId)
      }
    })
    if (result._tag === 'failure') {
      throw new Error(result.error)
    }
    return Buffer.from(result.image)
  }
}

export default {
  initWasmPromise: Promise.resolve(),
  Renderer: RendererWorkerProxy as unknown as typeof import('@takumi-rs/core').Renderer,
}
