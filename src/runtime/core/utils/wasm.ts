export async function importWasm(input: any) {
  console.log('pre', { type: typeof input, v: input })
  // may be a nested await for some reason
  const _input = await input
  console.log('awaited wasm input', { type: typeof _input, v: _input })
  const _module = _input.default || _input
  console.log('interop default', { type: typeof _module, v: _module })
  const _instance
    = typeof _module === 'function'
      ? await _module({}).then(r => r.instance || r)
      : await WebAssembly.instantiate(_module, {})
  console.log('instance', typeof _instance, _instance, _instance.exports)
  return _instance.exports
}
