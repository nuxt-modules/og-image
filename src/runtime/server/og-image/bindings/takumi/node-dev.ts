import { Worker } from 'node:worker_threads'
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
    parentPort.postMessage({ id, image: ab, fontWarnings }, [ab])
  } catch (err) {
    parentPort.postMessage({ id, error: err?.message || String(err) })
  }
})
parentPort.postMessage({ ready: true })
`

// Time budget for a single render EXECUTING on the worker. Queue wait time
// does not count — under concurrent prerendering many renders arrive at once
// and an enqueue-based timer would expire from backlog alone.
// Overridable for tests and unusually slow environments.
const RENDER_TIMEOUT = Number.parseInt(process.env.NUXT_OG_IMAGE_WORKER_TIMEOUT || '', 10) || 30_000
const MAX_ATTEMPTS = 2

interface Job {
  id: number
  // Built when the job starts executing, not when it is enqueued — the
  // worker (and therefore the font generation) may change while queued.
  buildMessage: () => Record<string, any>
  resolve: (value: any) => void
  reject: (err: Error) => void
  attempts: number
}

let worker: Worker | null = null
let workerReady = false
let workerGeneration = 0
let requestId = 0
const queue: Job[] = []
let active: Job | null = null
let activeStarted = false
let activeTimer: ReturnType<typeof setTimeout> | undefined

function terminateWorker() {
  if (!worker)
    return
  worker.removeAllListeners()
  worker.terminate()
  worker = null
  workerReady = false
}

function settleActive(settle: (job: Job) => void) {
  if (!active)
    return
  const job = active
  active = null
  activeStarted = false
  clearTimeout(activeTimer)
  settle(job)
}

// A dead worker only fails the job it was executing; queued jobs survive and
// run on a fresh worker. The failed job retries once — worker crashes here
// come from resource pressure, not from the payload being unrenderable.
function onWorkerDeath(reason: Error) {
  terminateWorker()
  settleActive((job) => {
    if (job.attempts < MAX_ATTEMPTS) {
      job.attempts++
      queue.unshift(job)
    }
    else {
      job.reject(reason)
    }
  })
  processQueue()
}

function shutdown() {
  terminateWorker()
  settleActive(job => job.reject(new Error('Takumi worker terminated')))
  for (const job of queue.splice(0))
    job.reject(new Error('Takumi worker terminated'))
}

// Clean up worker on process exit — avoid SIGINT/SIGTERM signal handlers because
// they keep the event loop alive and prevent exit after prerendering completes.
// Use Symbol.for guard to prevent duplicate listeners on HMR re-imports.
const signalKey = Symbol.for('og-image:takumi-worker-cleanup')
if (!(globalThis as any)[signalKey]) {
  (globalThis as any)[signalKey] = true
  process.on('exit', shutdown)
}

function createWorker() {
  workerGeneration++
  const w = new Worker(workerCode, { eval: true })
  w.on('message', ({ ready, id, image, urls, error, fontWarnings }) => {
    if (ready) {
      workerReady = true
      dispatchActive()
      return
    }
    if (!active || active.id !== id)
      return
    settleActive((job) => {
      if (error)
        job.reject(new Error(error))
      else if (urls !== undefined)
        job.resolve(urls)
      else
        job.resolve({ image: Buffer.from(image), fontWarnings })
    })
    processQueue()
  })
  w.on('error', (err: Error) => onWorkerDeath(err))
  w.on('exit', (code) => {
    if (worker === w)
      onWorkerDeath(new Error(`Takumi worker exited with code ${code}`))
  })
  // Allow process to exit even if the worker is still alive (e.g. after prerendering).
  // Must be called AFTER adding event listeners — listeners internally ref() the port.
  w.unref()
  return w
}

// One job executes on the worker at a time. The native render is single-threaded
// anyway, so this costs no throughput and gives each job an accurate timer.
// Jobs are only dispatched once the worker has signalled readiness, so the
// timer never includes worker boot, and buildMessage() runs against the
// worker generation the job will actually execute on.
function dispatchActive() {
  if (!active || activeStarted || !worker || !workerReady)
    return
  activeStarted = true
  activeTimer = setTimeout(() => {
    // The executing render is genuinely stuck — fail it, replace the worker,
    // and let the rest of the queue continue.
    terminateWorker()
    settleActive(stuck => stuck.reject(new Error(`takumi render timed out after ${RENDER_TIMEOUT}ms`)))
    processQueue()
  }, RENDER_TIMEOUT)
  worker.postMessage({ id: active.id, ...active.buildMessage() })
}

function processQueue() {
  if (active)
    return
  const job = queue.shift()
  if (!job)
    return
  if (!worker)
    worker = createWorker()
  active = job
  dispatchActive()
}

function postToWorker(buildMessage: () => Record<string, any>): Promise<any> {
  return new Promise((resolve, reject) => {
    queue.push({ id: ++requestId, buildMessage, resolve, reject, attempts: 1 })
    processQueue()
  })
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
    // processQueue() has created the worker (bumping workerGeneration on a
    // restart), so a crash while this job was queued triggers a full font
    // replay instead of rendering fontless on the fresh Renderer.
    return postToWorker(() => {
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
      return { type: 'render', newFonts: fontsToSend, nodes, options }
    }).then((result: any) => {
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
  extractResourceUrls,
}
