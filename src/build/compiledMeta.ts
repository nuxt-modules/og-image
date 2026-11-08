import type { Nuxt } from '@nuxt/schema'
import type { MetaShapes, OgMetaMode } from '../runtime/app/compiledMeta'
import { addTemplate, directoryToURL, tryResolveModule } from '@nuxt/kit'
import { OG_META_IDENTITIES, OG_META_MODES, ogMetaShapeInput } from '../runtime/app/compiledMeta'

type CompileResult = { _tag: 'Ok', tags: unknown } | { _tag: 'Bail', reason: string }

/** The Unhead compiler API the build needs, from `unhead/compiled/compile`. */
export interface HeadCompiler {
  compileTags: (input: unknown, options?: { dynamicValues?: number }) => CompileResult
  dynamicValue: (index: number) => string
}

export type CompiledMetaSetup
  = | { _tag: 'Off' }
    | { _tag: 'On' }
    | { _tag: 'Unavailable', reason: string }

/** Whether the app turns on Unhead compiler mode: `unhead.vite.compile` in the Nuxt config. */
export function isCompilerMode(nuxt: Nuxt): boolean {
  const vite = (nuxt.options as { unhead?: { vite?: false | { compile?: unknown } } }).unhead?.vite
  return !!vite && !!vite.compile
}

/**
 * Compiles one meta tag for each og:image identity and mode. The content of identity `i` is
 * dynamic value `i`, so the tags of any `generateMeta()` list concatenate into one entry.
 */
export function compileMetaShapes(compiler: HeadCompiler): { _tag: 'Ok', shapes: MetaShapes } | { _tag: 'Bail', reason: string } {
  const shapes = {} as MetaShapes
  for (const mode of Object.keys(OG_META_MODES) as OgMetaMode[]) {
    shapes[mode] = {}
    for (const [index, identity] of OG_META_IDENTITIES.entries()) {
      const result = compiler.compileTags(ogMetaShapeInput(mode, identity, compiler.dynamicValue(index)), { dynamicValues: OG_META_IDENTITIES.length })
      if (result._tag === 'Bail')
        return { _tag: 'Bail', reason: `${identity} (${mode}): ${result.reason}` }
      shapes[mode][identity] = result.tags as unknown[]
    }
  }
  return { _tag: 'Ok', shapes }
}

/**
 * The `#build/nuxt-og-image/compiled-meta.mjs` module. With compiler mode off it exports `null`
 * shapes and no composable, so the app never imports Unhead compiler entries it may not have.
 */
export function compiledMetaModule(compiled: { shapes: MetaShapes } | null): string {
  return compiled
    // A bare import, so each build takes its own half: the node export holds the server half only
    ? [`export { useCompiledHead } from '@unhead/vue/compiled'`, `export const metaShapes = ${JSON.stringify(compiled.shapes)}`].join('\n')
    : ['export const metaShapes = null', 'export const useCompiledHead = undefined'].join('\n')
}

/** The server half, `#build/nuxt-og-image/compiled-meta-server.mjs`: the public readers of compiled entries. */
export function compiledMetaServerModule(paths: { readCompiledEntry: string, toHeadInput: string } | null): string {
  return paths
    ? [`export { readCompiledEntry } from ${JSON.stringify(paths.readCompiledEntry)}`, `export { toHeadInput } from ${JSON.stringify(paths.toHeadInput)}`].join('\n')
    : ['export const readCompiledEntry = undefined', 'export const toHeadInput = undefined'].join('\n')
}

async function resolveFromApp(nuxt: Nuxt, id: string) {
  // Unhead must be the one that renders the app, so it resolves from the app.
  return tryResolveModule(id, nuxt.options.modulesDir.map(dir => directoryToURL(dir)))
}

async function compileMeta(nuxt: Nuxt) {
  // @unhead/vue/compiled only proves the Unhead has compiler mode; the app imports it by name
  const [compilerPath, serverPath, vuePath] = await Promise.all([
    resolveFromApp(nuxt, 'unhead/compiled/compile'),
    resolveFromApp(nuxt, 'unhead/compiled/server'),
    resolveFromApp(nuxt, '@unhead/vue/compiled'),
  ])
  if (!compilerPath || !serverPath || !vuePath)
    return { _tag: 'Unavailable', reason: 'the installed Unhead has no compiler (unhead/compiled/compile)' } as const
  // A dynamic import: an Unhead without the compiler must not break the module when compiler mode is off.
  const result = compileMetaShapes(await import(compilerPath) as HeadCompiler)
  if (result._tag === 'Bail')
    return { _tag: 'Unavailable', reason: `the og:image meta cannot compile: ${result.reason}` } as const
  return { _tag: 'Ok', compiled: { shapes: result.shapes, server: { readCompiledEntry: serverPath, toHeadInput: compilerPath } } } as const
}

/**
 * Compiles the og:image meta for compiler mode and adds it as `#build/nuxt-og-image/compiled-meta.mjs`.
 * With compiler mode off, or with an Unhead that has no compiler, the module exports `null`
 * shapes and the og:image meta stays normal input.
 */
export async function setupCompiledMeta(nuxt: Nuxt): Promise<CompiledMetaSetup> {
  const result = isCompilerMode(nuxt) ? await compileMeta(nuxt) : undefined
  const compiled = result?._tag === 'Ok' ? result.compiled : null
  addTemplate({
    filename: 'nuxt-og-image/compiled-meta.mjs',
    getContents: () => compiledMetaModule(compiled),
  })
  addTemplate({
    filename: 'nuxt-og-image/compiled-meta-server.mjs',
    getContents: () => compiledMetaServerModule(compiled?.server ?? null),
  })
  if (!result)
    return { _tag: 'Off' }
  return result._tag === 'Ok' ? { _tag: 'On' } : result
}
