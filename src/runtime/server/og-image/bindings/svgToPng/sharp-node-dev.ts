import { Worker } from 'node:worker_threads'

const workerCode = `
const { createRequire } = require('node:module')
const _require = createRequire(process.cwd() + '/')
const { parentPort } = require('node:worker_threads')
const sharp = _require('sharp')

parentPort.on('message', async ({ id, svg, width, height }) => {
  try {
    let pipeline = sharp(Buffer.from(svg))
    if (width && height) pipeline = pipeline.resize(width, height, { fit: 'fill' })
    const png = await pipeline.png().toBuffer()
    const ab = png.buffer.slice(png.byteOffset, png.byteOffset + png.byteLength)
    parentPort.postMessage({ id, png: ab }, [ab])
  } catch (err) {
    parentPort.postMessage({ id, error: err?.message || String(err) })
  }
})
`

let worker: Worker | null = null
let requestId = 0
const pending = new Map<number, { resolve: (png: Buffer) => void, reject: (err: Error) => void, timer: ReturnType<typeof setTimeout> }>()

function killWorker() {
  if (!worker)
    return
  worker.terminate()
  worker = null
  for (const [id, p] of pending) {
    clearTimeout(p.timer)
    pending.delete(id)
    p.reject(new Error('Image worker terminated'))
  }
}

const signalKey = Symbol.for('og-image:sharp-svg-to-png-worker-cleanup')
if (!(globalThis as any)[signalKey]) {
  (globalThis as any)[signalKey] = true
  process.on('exit', killWorker)
}

function createWorker() {
  const w = new Worker(workerCode, { eval: true })
  w.on('message', ({ id, png, error }) => {
    const p = pending.get(id)
    if (p) {
      clearTimeout(p.timer)
      pending.delete(id)
      if (error)
        p.reject(new Error(error))
      else
        p.resolve(Buffer.from(png))
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
        p.reject(new Error(`Image worker exited with code ${code}`))
      }
    }
    worker = null
  })
  w.unref()
  return w
}

function svgToPng(svg: string, width?: number, height?: number): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    if (!worker)
      worker = createWorker()

    const id = ++requestId
    const timer = setTimeout(() => {
      pending.delete(id)
      reject(new Error('Image worker timed out — killing worker'))
      killWorker()
    }, 30_000)
    pending.set(id, { resolve, reject, timer })
    worker.postMessage({ id, svg, width, height })
  })
}

export default {
  initWasmPromise: Promise.resolve(),
  svgToPng,
}
