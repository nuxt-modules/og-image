import { Worker } from 'node:worker_threads'
import { createWorkerQueue, parseWorkerTimeout } from '../worker-queue'

// Worker maintains a persistent Renderer instance. Font bytes are sent once
// per worker generation, then referenced by key. This dramatically reduces
// allocator pressure vs. creating a new Renderer + re-loading all fonts per
// render. Image fetching stays on the main thread, where Nitro's fetch lives.
const workerCode = `
const { createRequire } = require('node:module')
const _require = createRequire(process.cwd() + '/')
const { parentPort } = require('node:worker_threads')
const { Renderer } = _require('@takumi-rs/core')

const renderer = new Renderer()
const fontData = new Map()
const pendingFetches = new Map()
let fetchId = 0

function fetchFromMain(id, src) {
  return new Promise((resolve, reject) => {
    pendingFetches.set(++fetchId, { resolve, reject })
    parentPort.postMessage({ _tag: 'fetch', id, fetchId, src })
  })
}

parentPort.on('message', async (message) => {
  if (message.type === 'fetched') {
    const pending = pendingFetches.get(message.fetchId)
    pendingFetches.delete(message.fetchId)
    if (message.error)
      pending.reject(new Error(message.error))
    else
      pending.resolve(new Response(message.data))
    return
  }
  const { id, nodes, layout, fonts, images, format } = message
  try {
    const loaders = fonts.map((font) => {
      if (font.data)
        fontData.set(font.key, font.data)
      return { ...font, data: fontData.get(font.key) }
    })
    const prepared = await renderer.prepare(nodes, {
      ...layout,
      fonts: loaders,
      images: { sources: images, fetch: src => fetchFromMain(id, src), throwOnError: false },
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
  data?: Uint8Array
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
  fonts: FontLoader[]
  images: ImageSource[]
  format: 'png' | 'jpeg' | 'webp'
}

type RenderResponse
  = { _tag: 'success', image: ArrayBuffer }
    | { _tag: 'failure', error: string }

interface FetchRequest {
  _tag: 'fetch'
  id: number
  fetchId: number
  src: string
}

interface PreparedSource {
  nodes: unknown
  options: PrepareOptions
}

// Queue wait does not consume the per-render budget. Worker startup has its
// own bound so native addon load failures cannot leave prerendering hung.
const workerTimeout = parseWorkerTimeout(process.env.NUXT_OG_IMAGE_WORKER_TIMEOUT)
const imageFetchers = new Map<number, PrepareOptions['images']>()
const workerQueue = createWorkerQueue<RenderMessage, RenderResponse>({
  createWorker: () => {
    const worker = new Worker(workerCode, { eval: true })
    worker.on('message', async (message: Partial<FetchRequest>) => {
      if (message._tag !== 'fetch')
        return
      const { id, fetchId, src } = message as FetchRequest
      try {
        const images = imageFetchers.get(id)
        if (!images?.allowUrl(src))
          throw new Error(`Image ${src} is not allowed`)
        const data = await (await images.fetch(src)).arrayBuffer()
        worker.postMessage({ type: 'fetched', fetchId, data }, [data])
      }
      catch (err) {
        worker.postMessage({ type: 'fetched', fetchId, error: (err as Error).message })
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
// On worker crash/restart, the next render resends every font to the new Renderer.
class RendererWorkerProxy {
  private sentFontKeys = new Set<string>()
  private syncedGeneration = -1

  async prepare(nodes: unknown, options: PrepareOptions): Promise<PreparedSource> {
    return { nodes, options }
  }

  async render({ nodes, options }: PreparedSource, { format }: { format: RenderMessage['format'] }): Promise<Buffer> {
    const { fonts, images, ...layout } = options
    let jobId: number | undefined
    const result = await workerQueue.enqueue(({ id, generation }) => {
      jobId = id
      // A crash while this job was queued changes the generation, which triggers a full font replay.
      if (this.syncedGeneration !== generation) {
        this.sentFontKeys.clear()
      }
      this.syncedGeneration = generation
      imageFetchers.set(id, images)
      const fontsToSend = fonts.map(font => this.sentFontKeys.has(font.key) ? { ...font, data: undefined } : font)
      for (const font of fonts) {
        this.sentFontKeys.add(font.key)
      }
      return { id, nodes, layout, fonts: fontsToSend, images: images.sources, format }
    }).finally(() => {
      if (jobId !== undefined) {
        imageFetchers.delete(jobId)
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
