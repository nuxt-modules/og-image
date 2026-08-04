import { Worker } from 'node:worker_threads'
import { createWorkerQueue, parseWorkerTimeout } from '../worker-queue'
import { extractResourceUrls as extractTakumiResourceUrls } from './resource-urls'

// Worker maintains a persistent Renderer instance. Fonts are loaded
// incrementally — only new fonts are sent with each render request.
// This dramatically reduces allocator pressure vs. creating a new
// Renderer + re-loading all fonts per render.
const workerCode = `
const { createRequire } = require('node:module')
const _require = createRequire(process.cwd() + '/')
const { parentPort } = require('node:worker_threads')
const { Renderer } = _require('@takumi-rs/core')

let renderer = new Renderer()

parentPort.on('message', async ({ id, type, newFonts, nodes, options }) => {
  try {
    const fontWarnings = []
    for (const font of (newFonts || [])) {
      try {
        const registerFont = renderer.registerFont || renderer.loadFont
        if (typeof registerFont !== 'function')
          throw new Error('renderer does not expose loadFont/registerFont')
        await registerFont.call(renderer, {
          name: font.name,
          data: font.data,
          weight: font.weight,
          style: font.style,
        })
      } catch (e) {
        fontWarnings.push({ name: font.name, weight: font.weight, error: e?.message || String(e) })
      }
    }
    const image = await renderer.render(nodes, options)
    // Always slice to create a standard ArrayBuffer — native addon buffers
    // use external memory that can't be transferred via postMessage
    const ab = image.buffer.slice(image.byteOffset, image.byteOffset + image.byteLength)
    parentPort.postMessage({ _tag: 'response', id, payload: { _tag: 'success', image: ab, fontWarnings } }, [ab])
  } catch (err) {
    parentPort.postMessage({ _tag: 'response', id, payload: { _tag: 'failure', error: err?.message || String(err) } })
  }
})
parentPort.postMessage({ _tag: 'ready' })
`

interface RenderMessage {
  id: number
  type: 'render'
  newFonts: Font[]
  nodes: any
  options: RenderOptions
}

interface FontWarning {
  error: string
  name: string
  weight?: number
}

type RenderResponse
  = { _tag: 'success', image: ArrayBuffer, fontWarnings: FontWarning[] }
    | { _tag: 'failure', error: string }

// Queue wait does not consume the per-render budget. Worker startup has its
// own bound so native addon load failures cannot leave prerendering hung.
const workerTimeout = parseWorkerTimeout(process.env.NUXT_OG_IMAGE_WORKER_TIMEOUT)
const workerQueue = createWorkerQueue<RenderMessage, RenderResponse>({
  createWorker: () => new Worker(workerCode, { eval: true }),
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

interface Font {
  name: string
  data: Uint8Array
  weight?: number
  style?: string
}

interface RenderOptions {
  width: number
  height: number
  format: 'png' | 'jpeg' | 'webp'
}

function extractResourceUrls(nodes: any): Promise<string[]> {
  return Promise.resolve(extractTakumiResourceUrls(nodes))
}

// Proxy class matching Renderer interface but delegating to worker.
// Keeps a persistent Renderer in the worker — fonts are sent incrementally.
// On worker crash/restart, all fonts are replayed to the new Renderer.
class RendererWorkerProxy {
  private allFonts: Font[] = []
  private allFontKeys = new Set<string>()
  private pendingFonts: Font[] = []
  private syncedGeneration = -1

  loadFont(font: { name: string, data: Uint8Array, weight?: number, style?: 'normal' | 'italic' | 'oblique' }) {
    const key = `${font.name}|${font.weight || 400}|${font.style || 'normal'}`
    if (this.allFontKeys.has(key))
      return
    this.allFontKeys.add(key)
    this.allFonts.push(font)
    this.pendingFonts.push(font)
  }

  registerFont(font: { name: string, data: Uint8Array, weight?: number, style?: 'normal' | 'italic' | 'oblique' }) {
    this.loadFont(font)
  }

  render(nodes: any, options: RenderOptions): Promise<Buffer> {
    // Fonts are resolved when the job actually reaches the worker: by then
    // the queue has created the worker and assigned its generation. A crash
    // while this job was queued therefore triggers a full font replay.
    return workerQueue.enqueue(({ id, generation }) => {
      let fontsToSend: Font[]
      if (this.syncedGeneration !== generation) {
        // Worker was recreated — replay all fonts into the new Renderer
        fontsToSend = [...this.allFonts]
        this.pendingFonts = []
      }
      else {
        fontsToSend = this.pendingFonts.splice(0)
      }
      this.syncedGeneration = generation
      return { id, type: 'render', newFonts: fontsToSend, nodes, options }
    }).then((result) => {
      if (result._tag === 'failure')
        throw new Error(result.error)
      // Surface font loading warnings from the worker
      if (result.fontWarnings?.length) {
        for (const w of result.fontWarnings)
          console.warn(`[nuxt-og-image] Failed to load font "${w.name}" (weight: ${w.weight}) into takumi renderer: ${w.error}`)
      }
      return Buffer.from(result.image)
    })
  }
}

export default {
  initWasmPromise: Promise.resolve(),
  Renderer: RendererWorkerProxy as unknown as typeof import('@takumi-rs/core').Renderer,
  extractResourceUrls,
}
