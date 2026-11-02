const takumiInstance: { instance?: { initWasmPromise: Promise<void>, Renderer: any } } = { instance: undefined }

async function ensureInstance() {
  takumiInstance.instance = takumiInstance.instance || await import('#og-image/bindings/takumi').then(m => m.default)
  await takumiInstance.instance!.initWasmPromise
  return takumiInstance.instance!
}

export async function getTakumi() {
  return (await ensureInstance()).Renderer
}
