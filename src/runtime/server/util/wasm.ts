import { readFile } from 'node:fs/promises'
import { resolvePath } from 'mlly'

export async function importWasm(input: any) {
  // may be a nested await for some reason
  const _input = await input
  const _module = _input.default || _input
  // this is from rollup/wasm, it does some magic we need to recover from
  if (typeof _module === 'function') {
    // empty input is to avoid instantiating the wasm module
    // this will just compile it
    const fnRes = await _module()
    const _instance = fnRes.instance || fnRes
    return _instance.exports || _instance || _module
  }
  return _module
}

export async function readWasmFile(input: string) {
  const path = await resolvePath(input)
  return readFile(path) // stackblitz provides fs
}
