import { Worker } from 'node:worker_threads'

// Worker maintains a persistent Renderer instance. Fonts are loaded
// incrementally — only new fonts are sent with each render request.
// This dramatically reduces allocator pressure vs. creating a new
// Renderer + re-loading all fonts per render.
const workerCode = `
const { createRequire } = require('node:module')
const _require = createRequire(process.cwd() + '/')
const { parentPort } = require('node:worker_threads')
const { Renderer, extractResourceUrls } = _require('@takumi-rs/core')

let renderer = new Renderer()

parentPort.on('message', async ({ id, type, newFonts, nodes, options }) => {
  try {
    if (type === 'extractResourceUrls') {
      const urls = extractResourceUrls(nodes)
      parentPort.postMessage({ id, urls })
      return
    }
    const fontWarnings = []
    for (const font of (newFonts || [])) {
      try {
        await renderer.loadFont({
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
    parentPort.postMessage({ id, image: ab, fontWarnings }, [ab])
  } catch (err) {
    parentPort.postMessage({ id, error: err?.message || String(err) })
  }
})
`

let worker: Worker | null = null
let workerGeneration = 0
let requestId = 0
const pending = new Map<number, { resolve: (value: any) => void, reject: (err: Error) => void, timer: ReturnType<typeof setTimeout> }>()

function killWorker() {
  if (!worker)
    return
  worker.terminate()
  worker = null
  for (const [id, p] of pending) {
    clearTimeout(p.timer)
    pending.delete(id)
    p.reject(new Error('Takumi worker terminated'))
  }
}

// Clean up worker on process exit — avoid SIGINT/SIGTERM signal handlers because
// they keep the event loop alive and prevent exit after prerendering completes.
// Use Symbol.for guard to prevent duplicate listeners on HMR re-imports.
const signalKey = Symbol.for('og-image:takumi-worker-cleanup')
if (!(globalThis as any)[signalKey]) {
  (globalThis as any)[signalKey] = true
  process.on('exit', killWorker)
}

function createWorker() {
  workerGeneration++
  const w = new Worker(workerCode, { eval: true })
  w.on('message', ({ id, image, urls, error, fontWarnings }) => {
    const p = pending.get(id)
    if (p) {
      clearTimeout(p.timer)
      pending.delete(id)
      if (error)
        p.reject(new Error(error))
      else if (urls !== undefined)
        p.resolve(urls)
      else
        p.resolve({ image: Buffer.from(image), fontWarnings })
    }
  })
  w.on('error', (err: Error) => {
    for (const [id, p] of pending) {
      clearTimeout(p.timer)
      pending.delete(id)
      p.reject(err)
    }
    worker = null
  })
  w.on('exit', (code) => {
    if (code !== 0) {
      for (const [id, p] of pending) {
        clearTimeout(p.timer)
        pending.delete(id)
        p.reject(new Error(`Takumi worker exited with code ${code}`))
      }
    }
    worker = null
  })
  // Allow process to exit even if the worker is still alive (e.g. after prerendering).
  // Must be called AFTER adding event listeners — listeners internally ref() the port.
  w.unref()
  return w
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

function ensureWorker() {
  if (!worker)
    worker = createWorker()
}

function postToWorker(msg: Record<string, any>, timeoutMs = 30_000): Promise<any> {
  return new Promise((resolve, reject) => {
    ensureWorker()

    const id = ++requestId
    const timer = setTimeout(() => {
      pending.delete(id)
      reject(new Error('takumi worker timed out — killing worker'))
      killWorker()
    }, timeoutMs)
    pending.set(id, { resolve, reject, timer })
    worker!.postMessage({ id, ...msg })
  })
}

function extractResourceUrls(nodes: any): Promise<string[]> {
  return postToWorker({ type: 'extractResourceUrls', nodes })
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

  render(nodes: any, options: RenderOptions): Promise<Buffer> {
    // Ensure worker exists BEFORE checking generation — createWorker()
    // increments workerGeneration, so we need the final value to decide
    // whether to replay all fonts (crash recovery) or send only new ones
    ensureWorker()

    let fontsToSend: Font[]
    if (this.syncedGeneration !== workerGeneration) {
      // Worker was recreated — replay all fonts into the new Renderer
      fontsToSend = [...this.allFonts]
      this.pendingFonts = []
    }
    else {
      fontsToSend = this.pendingFonts.splice(0)
    }
    this.syncedGeneration = workerGeneration
    return postToWorker({ type: 'render', newFonts: fontsToSend, nodes, options }).then((result: any) => {
      // Surface font loading warnings from the worker
      if (result.fontWarnings?.length) {
        for (const w of result.fontWarnings)
          console.warn(`[nuxt-og-image] Failed to load font "${w.name}" (weight: ${w.weight}) into takumi renderer: ${w.error}`)
      }
      return result.image
    })
  }
}

export default {
  initWasmPromise: Promise.resolve(),
  Renderer: RendererWorkerProxy as unknown as typeof import('@takumi-rs/core').Renderer,
  extractResourceUrls: extractResourceUrls as unknown as typeof import('@takumi-rs/core').extractResourceUrls,
}
