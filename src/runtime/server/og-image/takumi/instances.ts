const takumiInstance: { instance?: { initWasmPromise: Promise<void>, Renderer: any } } = { instance: undefined }

export async function useTakumi() {
  takumiInstance.instance = takumiInstance.instance || await import('#og-image/bindings/takumi').then(m => m.default)
  await takumiInstance.instance!.initWasmPromise
  return takumiInstance.instance!.Renderer
}
