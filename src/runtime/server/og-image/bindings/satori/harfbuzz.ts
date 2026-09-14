import wrapHarfBuzz from '#og-image/harfbuzz-adapter'
import callbackModules from '#og-image/harfbuzz-callbacks'
import createHarfBuzz from '#og-image/harfbuzz-factory'

type WasmFactory = (imports: WebAssembly.Imports) => WebAssembly.Instance | { instance: WebAssembly.Instance } | Promise<WebAssembly.Instance | { instance: WebAssembly.Instance }>

export default import('#og-image/harfbuzz-wasm' as string).then(async ({ default: importedWasm }: { default: WebAssembly.Module | WasmFactory | Promise<WebAssembly.Module> }) => {
  const wasm = await importedWasm
  const callbacks = callbackModules && Object.fromEntries(await Promise.all(
    Object.entries(callbackModules).map(async ([signature, module]) => [signature, await module]),
  ))
  return new Promise((resolve, reject) => {
    createHarfBuzz({
      ...callbacks && {
        convertJsFunctionToWasm(callback: WebAssembly.ImportValue, signature: string) {
          return new WebAssembly.Instance(callbacks[signature]!, { e: { f: callback } }).exports.f!
        },
      },
      instantiateWasm(imports, receiveInstance) {
        // Edge imports provide a compiled module. Rollup inline imports provide a factory.
        Promise.resolve().then(() => typeof wasm === 'function'
          ? wasm(imports)
          : new WebAssembly.Instance(wasm, imports)).then((result) => {
          receiveInstance('instance' in result ? result.instance : result)
        }).catch(reject)
        return {}
      },
    }).then(wrapHarfBuzz).then(resolve, reject)
  })
})
