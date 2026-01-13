import type { ResvgRenderOptions } from '@resvg/resvg-js'
import { Worker } from 'node:worker_threads'

const workerCode = `
const { parentPort } = require('node:worker_threads')
const { Resvg } = require('@resvg/resvg-js')

parentPort.on('message', ({ id, svg, options }) => {
  const resvg = new Resvg(svg, options)
  const png = resvg.render().asPng()
  parentPort.postMessage({ id, png })
})
`

let worker: Worker | null = null
let requestId = 0
const pending = new Map<number, { resolve: (png: Buffer) => void, reject: (err: Error) => void }>()

function createWorker() {
  const w = new Worker(workerCode, { eval: true })
  w.on('message', ({ id, png }) => {
    const p = pending.get(id)
    if (p) {
      pending.delete(id)
      p.resolve(Buffer.from(png))
    }
  })
  w.on('error', (err: Error) => {
    for (const [id, p] of pending) {
      pending.delete(id)
      p.reject(err)
    }
    worker = null
  })
  w.on('exit', (code) => {
    if (code !== 0) {
      for (const [id, p] of pending) {
        pending.delete(id)
        p.reject(new Error(`Resvg worker exited with code ${code}`))
      }
      worker = null
    }
  })
  return w
}

function renderPng(svg: string, options?: ResvgRenderOptions): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    if (!worker)
      worker = createWorker()

    const id = ++requestId
    pending.set(id, { resolve, reject })
    worker.postMessage({ id, svg, options })
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
