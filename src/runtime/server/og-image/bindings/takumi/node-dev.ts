import { Worker } from 'node:worker_threads'

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
const pending = new Map<number, { resolve: (image: Buffer) => void, reject: (err: Error) => void }>()

function createWorker() {
  const w = new Worker(workerCode, { eval: true })
  w.on('message', ({ id, image, error }) => {
    const p = pending.get(id)
    if (p) {
      pending.delete(id)
      if (error)
        p.reject(new Error(error))
      else
        p.resolve(Buffer.from(image))
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
        p.reject(new Error(`Takumi worker exited with code ${code}`))
      }
      worker = null
    }
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
    pending.set(id, { resolve, reject })
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
}
