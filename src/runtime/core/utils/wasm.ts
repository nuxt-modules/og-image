export async function importWasm(input: any) {
  console.log('pre', { type: typeof input, v: input })
  // may be a nested await for some reason
  const _input = await input
  console.log('awaited wasm input', { type: typeof _input, v: _input })
  const _module = _input.default || _input
  console.log('interop default', { type: typeof _module, v: _module })
  let _instance
  // this is from rollup/wasm, it does some magic we need to recover from
  if (typeof _module === 'function') {
    console.log('interop rollup wasm fn')
    // empty input is to avoid instantiating the wasm module
    // this will just compile it
    const fnRes = await _module().catch(e => {
      console.error('interop module error', e)
      return e
    })
    _instance = fnRes.instance || fnRes
    return _instance.exports || _instance || _module
  }
  return _module
}
