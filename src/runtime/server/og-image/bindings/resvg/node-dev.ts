import type { ResvgRenderOptions } from '@resvg/resvg-js'
import { Worker } from 'node:worker_threads'

const workerCode = `
const { createRequire } = require('node:module')
const _require = createRequire(process.cwd() + '/')
const { parentPort } = require('node:worker_threads')
const { Resvg } = _require('@resvg/resvg-js')

parentPort.on('message', ({ id, svg, options }) => {
  try {
    const resvg = new Resvg(svg, options)
    const png = resvg.render().asPng()
    // Always slice to create a standard ArrayBuffer — native addon buffers
    // use external memory that can't be transferred via postMessage
    const ab = png.buffer.slice(png.byteOffset, png.byteOffset + png.byteLength)
    parentPort.postMessage({ id, png: ab }, [ab])
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
  svg: string
  options?: ResvgRenderOptions
  resolve: (png: Buffer) => void
  reject: (err: Error) => void
  attempts: number
}

let worker: Worker | null = null
let workerReady = false
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
// come from resource pressure, not from the SVG being unrenderable.
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
  settleActive(job => job.reject(new Error('Resvg worker terminated')))
  for (const job of queue.splice(0))
    job.reject(new Error('Resvg worker terminated'))
}

// Clean up worker on process exit — avoid SIGINT/SIGTERM signal handlers because
// they keep the event loop alive and prevent exit after prerendering completes.
// Use Symbol.for guard to prevent duplicate listeners on HMR re-imports.
const signalKey = Symbol.for('og-image:resvg-worker-cleanup')
if (!(globalThis as any)[signalKey]) {
  (globalThis as any)[signalKey] = true
  process.on('exit', shutdown)
}

function createWorker() {
  const w = new Worker(workerCode, { eval: true })
  w.on('message', ({ ready, id, png, error }) => {
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
      else
        job.resolve(Buffer.from(png))
    })
    processQueue()
  })
  w.on('error', (err: Error) => onWorkerDeath(err))
  w.on('exit', (code) => {
    if (worker === w)
      onWorkerDeath(new Error(`Resvg worker exited with code ${code}`))
  })
  // Allow process to exit even if the worker is still alive (e.g. after prerendering).
  // Must be called AFTER adding event listeners — listeners internally ref() the port.
  w.unref()
  return w
}

// One job executes on the worker at a time. The native render is single-threaded
// anyway, so this costs no throughput and gives each job an accurate timer.
// Jobs are only dispatched once the worker has signalled readiness, so the
// timer never includes worker boot (thread spawn plus native addon load).
function dispatchActive() {
  if (!active || activeStarted || !worker || !workerReady)
    return
  activeStarted = true
  activeTimer = setTimeout(() => {
    // The executing render is genuinely stuck — fail it, replace the worker,
    // and let the rest of the queue continue.
    terminateWorker()
    settleActive(stuck => stuck.reject(new Error(`resvg render timed out after ${RENDER_TIMEOUT}ms`)))
    processQueue()
  }, RENDER_TIMEOUT)
  worker.postMessage({ id: active.id, svg: active.svg, options: active.options })
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

function renderPng(svg: string, options?: ResvgRenderOptions): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    queue.push({ id: ++requestId, svg, options, resolve, reject, attempts: 1 })
    processQueue()
  })
}

// Proxy class matching Resvg interface but delegating to worker
class ResvgWorkerProxy {
  private svg: string
  private options?: ResvgRenderOptions
  private pngPromise: Promise<Buffer> | null = null

  constructor(svg: string, options?: ResvgRenderOptions) {
    this.svg = svg
    this.options = options
  }

  render() {
    // Start rendering lazily
    if (!this.pngPromise)
      this.pngPromise = renderPng(this.svg, this.options)

    return {
      asPng: () => this.pngPromise!,
    }
  }
}

export default {
  initWasmPromise: Promise.resolve(),
  Resvg: ResvgWorkerProxy as unknown as typeof import('@resvg/resvg-wasm').Resvg,
}
