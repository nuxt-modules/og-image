const takumiInstance: { instance?: { initWasmPromise: Promise<void>, Renderer: any, extractResourceUrls: (node: any) => string[] } } = { instance: undefined }

async function ensureInstance() {
  takumiInstance.instance = takumiInstance.instance || await import('#og-image/bindings/takumi').then(m => m.default)
  await takumiInstance.instance!.initWasmPromise
  return takumiInstance.instance!
}

export async function useTakumi() {
  return (await ensureInstance()).Renderer
}

export async function useExtractResourceUrls() {
  return (await ensureInstance()).extractResourceUrls
}
