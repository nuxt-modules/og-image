import type { ResvgRenderOptions } from '@resvg/resvg-js'
import { Worker } from 'node:worker_threads'
import { createWorkerQueue, parseWorkerTimeout } from '../worker-queue'

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
    parentPort.postMessage({ _tag: 'response', id, payload: { _tag: 'success', png: ab } }, [ab])
  } catch (err) {
    parentPort.postMessage({ _tag: 'response', id, payload: { _tag: 'failure', error: err?.message || String(err) } })
  }
})
parentPort.postMessage({ _tag: 'ready' })
`

interface RenderMessage {
  id: number
  svg: string
  options?: ResvgRenderOptions
}

type RenderResponse
  = { _tag: 'success', png: ArrayBuffer }
    | { _tag: 'failure', error: string }

// Queue wait does not consume the per-render budget. Worker startup has its
// own bound so native addon load failures cannot leave prerendering hung.
const workerTimeout = parseWorkerTimeout(process.env.NUXT_OG_IMAGE_WORKER_TIMEOUT)
const workerQueue = createWorkerQueue<RenderMessage, RenderResponse>({
  createWorker: () => new Worker(workerCode, { eval: true }),
  executionTimeout: workerTimeout,
  startupTimeout: workerTimeout,
  label: 'resvg',
})

function renderPng(svg: string, options?: ResvgRenderOptions): Promise<Buffer> {
  return workerQueue.enqueue(({ id }) => ({ id, svg, options })).then((result) => {
    if (result._tag === 'failure')
      throw new Error(result.error)
    return Buffer.from(result.png)
  })
}

// Clean up worker on process exit — avoid SIGINT/SIGTERM signal handlers because
// they keep the event loop alive and prevent exit after prerendering completes.
// Use Symbol.for guard to prevent duplicate listeners on HMR re-imports.
const signalKey = Symbol.for('og-image:resvg-worker-cleanup')
if (!(globalThis as any)[signalKey]) {
  (globalThis as any)[signalKey] = true
  process.on('exit', workerQueue.shutdown)
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
