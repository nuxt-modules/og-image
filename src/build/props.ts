/**
 * Extract prop metadata from a Vue SFC's `defineProps` declaration.
 *
 * Uses `@vue/compiler-sfc` (already a dependency) to reliably parse all
 * three defineProps syntaxes: TS generics, runtime objects, and arrays.
 * The `compileScript` API resolves bindings and emits normalized runtime
 * prop declarations that we parse for type information.
 */
import type { SFCDescriptor } from '@vue/compiler-sfc'

export interface ExtractedProp {
  type: string
  required: boolean
}

let _parse: typeof import('@vue/compiler-sfc').parse | undefined
let _compileScript: typeof import('@vue/compiler-sfc').compileScript | undefined

export async function loadSfcCompiler() {
  if (!_parse) {
    const sfc = await import('@vue/compiler-sfc')
    _parse = sfc.parse
    _compileScript = sfc.compileScript
  }
}

// Matches: `propName: { type: String, required: false }` or `type: [String, Number]`
const RE_PROP_ENTRY = /(\w+):\s*\{\s*type:\s*(\[[\w\s,]+\]|\w+)(?:,\s*required:\s*(\w+))?/g

function normalizeType(raw: string): string {
  // Handle array syntax: [String, Number] -> "string | number"
  if (raw.startsWith('[')) {
    return raw
      .slice(1, -1)
      .split(',')
      .map(t => t.trim().toLowerCase())
      .join(' | ')
  }
  return raw.toLowerCase()
}

export function extractPropsFromVue(code: string): Record<string, ExtractedProp> | null {
  if (!_parse || !_compileScript)
    return null

  let descriptor: SFCDescriptor
  try {
    descriptor = _parse(code).descriptor
  }
  catch {
    return null
  }

  if (!descriptor.scriptSetup)
    return null

  try {
    const compiled = _compileScript(descriptor, { id: 'prop-extract' })
    if (!compiled.bindings)
      return null

    // Check if any bindings are props
    const hasPropBindings = Object.values(compiled.bindings).some(type => type === 'props')
    if (!hasPropBindings)
      return null

    // Parse the generated runtime props from compiled output for type info
    const propBlock = compiled.content.match(/props:\s*\{([\s\S]*?)\n {2}\}/)
    if (!propBlock)
      return null

    const props: Record<string, ExtractedProp> = {}
    let m: RegExpExecArray | null
    // eslint-disable-next-line no-cond-assign
    while ((m = RE_PROP_ENTRY.exec(propBlock[1]!))) {
      props[m[1]!] = {
        type: normalizeType(m[2]!),
        required: m[3] === 'true',
      }
    }
    RE_PROP_ENTRY.lastIndex = 0
    return Object.keys(props).length > 0 ? props : null
  }
  catch {
    return null
  }
}
