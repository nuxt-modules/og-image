import { Worker } from 'node:worker_threads'

const workerCode = `
const { createRequire } = require('node:module')
const _require = createRequire(process.cwd() + '/')
const { parentPort } = require('node:worker_threads')
const { Transformer } = _require('@napi-rs/image')

parentPort.on('message', async ({ id, svg, width, height }) => {
  try {
    const t = Transformer.fromSvg(svg)
    if (width && height) t.crop(0, 0, width, height)
    const png = await t.png()
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

// Clean up worker on process exit — avoid SIGINT/SIGTERM signal handlers because
// they keep the event loop alive and prevent exit after prerendering completes.
// Use Symbol.for guard to prevent duplicate listeners on HMR re-imports.
const signalKey = Symbol.for('og-image:svg-to-png-worker-cleanup')
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
  // Allow process to exit even if the worker is still alive (e.g. after prerendering).
  // Must be called AFTER adding event listeners — listeners internally ref() the port.
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
