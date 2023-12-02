export async function importWasm(input: any) {
  const _input = await input
  console.log('awaited wasm input', typeof _input, input)
  const _module = _input.default || _input
  console.log('interop default', typeof _input, input)
  const _instance
    = typeof _module === 'function'
      ? await _module({}).then(r => r.instance || r)
      : await WebAssembly.instantiate(_module, {})
  console.log('instance', typeof _instance, _instance, _instance.exports)
  return _instance.exports
}
