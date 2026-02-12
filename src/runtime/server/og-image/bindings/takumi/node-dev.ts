import { Worker } from 'node:worker_threads'
import { extractResourceUrls } from '@takumi-rs/core'

const workerCode = `
const { parentPort } = require('node:worker_threads')
const { Renderer } = require('@takumi-rs/core')

parentPort.on('message', async ({ id, fonts, nodes, options }) => {
  try {
    const renderer = new Renderer()
    for (const font of fonts) {
      await renderer.loadFont({
        name: font.name,
        data: font.data,
        weight: font.weight,
        style: font.style,
      })
    }
    const image = await renderer.render(nodes, options)
    parentPort.postMessage({ id, image })
  } catch (err) {
    parentPort.postMessage({ id, error: err?.message || String(err) })
  }
})
`

let worker: Worker | null = null
let requestId = 0
const pending = new Map<number, { resolve: (image: Buffer) => void, reject: (err: Error) => void, timer: ReturnType<typeof setTimeout> }>()

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

// Ensure worker doesn't keep the process alive on exit/signals
process.on('exit', killWorker)
process.on('SIGINT', () => {
  killWorker()
  process.exit(130)
})
process.on('SIGTERM', () => {
  killWorker()
  process.exit(143)
})

function createWorker() {
  const w = new Worker(workerCode, { eval: true })
  w.on('message', ({ id, image, error }) => {
    const p = pending.get(id)
    if (p) {
      clearTimeout(p.timer)
      pending.delete(id)
      if (error)
        p.reject(new Error(error))
      else
        p.resolve(Buffer.from(image))
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

function render(fonts: Font[], nodes: any, options: RenderOptions): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    if (!worker)
      worker = createWorker()

    const id = ++requestId
    // If WASM blocks the worker event loop, the only recovery is to kill the worker
    const timer = setTimeout(() => {
      pending.delete(id)
      reject(new Error('takumi render timed out after 3s — killing worker'))
      killWorker()
    }, 3000)
    pending.set(id, { resolve, reject, timer })
    worker.postMessage({ id, fonts, nodes, options })
  })
}

// Proxy class matching Renderer interface but delegating to worker
class RendererWorkerProxy {
  private fonts: Font[] = []

  loadFont(font: { name: string, data: Uint8Array, weight?: number, style?: 'normal' | 'italic' | 'oblique' }) {
    this.fonts.push(font)
  }

  render(nodes: any, options: RenderOptions): Promise<Buffer> {
    return render(this.fonts, nodes, options)
  }
}

export default {
  initWasmPromise: Promise.resolve(),
  Renderer: RendererWorkerProxy as unknown as typeof import('@takumi-rs/core').Renderer,
  extractResourceUrls,
}
