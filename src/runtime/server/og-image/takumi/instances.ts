// eslint-disable-next-line @typescript-eslint/no-explicit-any
const takumiInstance: { instance?: { initWasmPromise: Promise<void>, Renderer: any } } = { instance: undefined }

export async function useTakumi() {
  // @ts-expect-error virtual module
  takumiInstance.instance = takumiInstance.instance || await import('#og-image/bindings/takumi').then(m => m.default)
  await takumiInstance.instance!.initWasmPromise
  return takumiInstance.instance!.Renderer
}
