export async function importWasm(input: any) {
  const _input = await input
  const _module = _input.default || _input
  const _instance
    = typeof _module === 'function'
      ? await _module({}).then(r => r.instance || r)
      : await WebAssembly.instantiate(_module, {})
  return _instance.exports
}
