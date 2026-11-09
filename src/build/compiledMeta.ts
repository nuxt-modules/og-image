import type { Nuxt } from '@nuxt/schema'
import type { MetaShapes, OgMetaMode } from '../runtime/app/compiledMeta'
import { addTemplate, directoryToURL, tryResolveModule } from '@nuxt/kit'
import { OG_META_IDENTITIES, OG_META_MODES, ogMetaShapeInput } from '../runtime/app/compiledMeta'

type CompileResult = { _tag: 'Ok', tags: unknown } | { _tag: 'Bail', reason: string }

/** The Unhead compiler API the build needs, from `unhead/compiled`. */
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

/**
 * The server half, `#build/nuxt-og-image/compiled-meta-server.mjs`: `readEntry`, the Unhead reader
 * of any head entry, and `withTagTransform`, under compiler mode. The reader reads every head,
 * so it exists with compiler mode off too.
 */
export function compiledMetaServerModule(readerPath: string | null, transformPath: string | null): string {
  return [
    readerPath ? `export { readEntry } from ${JSON.stringify(readerPath)}` : 'export const readEntry = undefined',
    transformPath ? `export { withTagTransform } from ${JSON.stringify(transformPath)}` : 'export const withTagTransform = undefined',
  ].join('\n')
}

async function resolveFromApp(nuxt: Nuxt, id: string) {
  // Unhead must be the one that renders the app, so it resolves from the app.
  return tryResolveModule(id, nuxt.options.modulesDir.map(dir => directoryToURL(dir)))
}

type HeadCompilerModule = Partial<HeadCompiler> & { readEntry?: unknown }

async function loadCompiler(nuxt: Nuxt): Promise<{ path: string, compiler: HeadCompilerModule } | undefined> {
  const path = await resolveFromApp(nuxt, 'unhead/compiled')
  // A dynamic import: an Unhead without `unhead/compiled` must not break the module.
  return path ? { path, compiler: await import(path) as HeadCompilerModule } : undefined
}

// The path of `unhead/plugins` when it has tag transforms
async function loadTransforms(nuxt: Nuxt): Promise<string | undefined> {
  const path = await resolveFromApp(nuxt, 'unhead/plugins')
  const plugins = path ? await import(path) as { withTagTransform?: unknown } : undefined
  return typeof plugins?.withTagTransform === 'function' ? path : undefined
}

async function compileMeta(nuxt: Nuxt, loaded: Awaited<ReturnType<typeof loadCompiler>>, transformPath: string | undefined) {
  // @unhead/vue/compiled only proves the Unhead has compiler mode; the app imports it by name
  const vuePath = await resolveFromApp(nuxt, '@unhead/vue/compiled')
  const compiler = vuePath ? loaded?.compiler : undefined
  if (typeof compiler?.compileTags !== 'function' || typeof compiler.readEntry !== 'function')
    return { _tag: 'Unavailable', reason: 'the installed Unhead has no compiler (compileTags and readEntry in unhead/compiled)' } as const
  if (!transformPath)
    return { _tag: 'Unavailable', reason: 'the installed Unhead has no tag transforms (withTagTransform in unhead/plugins)' } as const
  const result = compileMetaShapes(compiler as HeadCompiler)
  if (result._tag === 'Bail')
    return { _tag: 'Unavailable', reason: `the og:image meta cannot compile: ${result.reason}` } as const
  return { _tag: 'Ok', shapes: result.shapes } as const
}

/**
 * Compiles the og:image meta for compiler mode and adds it as `#build/nuxt-og-image/compiled-meta.mjs`.
 * With compiler mode off, or with an Unhead that has no compiler, the module exports `null`
 * shapes and the og:image meta stays normal input. The `metaShapes` export is how the runtime
 * knows the head takes compiled tags.
 */
export async function setupCompiledMeta(nuxt: Nuxt): Promise<CompiledMetaSetup> {
  const loaded = await loadCompiler(nuxt)
  const transformPath = isCompilerMode(nuxt) ? await loadTransforms(nuxt) : undefined
  const result = isCompilerMode(nuxt) ? await compileMeta(nuxt, loaded, transformPath) : undefined
  const compiled = result?._tag === 'Ok' ? { shapes: result.shapes } : null
  const readerPath = loaded && typeof loaded.compiler.readEntry === 'function' ? loaded.path : null
  addTemplate({
    filename: 'nuxt-og-image/compiled-meta.mjs',
    getContents: () => compiledMetaModule(compiled),
  })
  addTemplate({
    filename: 'nuxt-og-image/compiled-meta-server.mjs',
    getContents: () => compiledMetaServerModule(readerPath, compiled && transformPath ? transformPath : null),
  })
  if (!result)
    return { _tag: 'Off' }
  return result._tag === 'Ok' ? { _tag: 'On' } : result
}
