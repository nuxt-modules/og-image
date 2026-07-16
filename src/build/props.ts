/**
 * Extract prop names from a Vue SFC's `defineProps` declaration.
 *
 * Uses `@vue/compiler-sfc` (already a dependency) to reliably parse all
 * three defineProps syntaxes: TS generics, runtime objects, and arrays.
 * The `compileScript` API resolves bindings, so we just filter for "props".
 */
import type { SFCDescriptor } from '@vue/compiler-sfc'

let _parse: typeof import('@vue/compiler-sfc').parse | undefined
let _compileScript: typeof import('@vue/compiler-sfc').compileScript | undefined

export async function loadSfcCompiler() {
  if (!_parse) {
    const sfc = await import('@vue/compiler-sfc')
    _parse = sfc.parse
    _compileScript = sfc.compileScript
  }
}

export function extractPropNamesFromVue(code: string): string[] {
  if (!_parse || !_compileScript)
    return []

  let descriptor: SFCDescriptor
  try {
    descriptor = _parse(code).descriptor
  }
  catch {
    return []
  }

  if (!descriptor.scriptSetup)
    return []

  try {
    const compiled = _compileScript(descriptor, { id: 'prop-extract' })
    if (!compiled.bindings)
      return []
    return Object.entries(compiled.bindings)
      .filter(([, type]) => type === 'props')
      .map(([name]) => name)
  }
  catch {
    return []
  }
}
