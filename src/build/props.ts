/**
 * Extract prop names from a Vue SFC's `defineProps` declaration.
 *
 * Uses the Nuxt app's `@vue/compiler-sfc` to reliably parse all
 * three defineProps syntaxes: TS generics, runtime objects, and arrays.
 * The `compileScript` API resolves bindings, so we just filter for "props".
 */
import type { SFCDescriptor } from '@vue/compiler-sfc'
import { loadSfcCompiler as loadCompiler } from './sfc-compiler'

type SfcCompiler = Awaited<ReturnType<typeof loadCompiler>>

let compiler: SfcCompiler | undefined

export async function loadSfcCompiler(): Promise<void> {
  compiler ||= await loadCompiler()
}

export function extractPropNamesFromVue(code: string): string[] {
  if (!compiler)
    return []

  let descriptor: SFCDescriptor
  try {
    descriptor = compiler.parse(code).descriptor
  }
  catch {
    return []
  }

  if (!descriptor.scriptSetup)
    return []

  try {
    const compiled = compiler.compileScript(descriptor, { id: 'prop-extract' })
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
