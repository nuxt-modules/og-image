export type EjectRenderer = 'takumi' | 'satori' | 'browser'

const RENDERER_PREFERENCE: EjectRenderer[] = ['takumi', 'satori', 'browser']
const RE_TEMPLATE_FILE = /^(.+)\.(takumi|satori|browser)\.vue$/

/** Packages that mean the app has a renderer. Mirrors the module's provider dependencies. */
export const RENDERER_PACKAGES: Record<EjectRenderer, string[]> = {
  takumi: ['@takumi-rs/core', '@takumi-rs/wasm'],
  satori: ['satori'],
  browser: ['playwright-core'],
}

export interface EjectContext {
  /** community template file names, e.g. `NuxtSeo.takumi.vue` */
  templateFiles: string[]
  /** renderer suffixes of the templates the app already has */
  appRenderers: EjectRenderer[]
  /** renderers whose packages the app depends on */
  installedRenderers: EjectRenderer[]
}

export type EjectResolution
  = | { _tag: 'Ok', file: string, renderer: EjectRenderer, reason: 'exact' | 'only-variant' | 'app-templates' | 'installed' | 'default' }
    | { _tag: 'NotFound', name: string, available: string[] }

function parseTemplateFile(file: string): { baseName: string, renderer: EjectRenderer } | null {
  const match = RE_TEMPLATE_FILE.exec(file)
  if (!match)
    return null
  return { baseName: match[1]!, renderer: match[2] as EjectRenderer }
}

/** Every template name the CLI accepts: base names plus each `Name.renderer` variant. */
export function listEjectableNames(templateFiles: string[]): string[] {
  const names = new Set<string>()
  for (const file of templateFiles) {
    const parsed = parseTemplateFile(file)
    if (!parsed)
      continue
    names.add(parsed.baseName)
    names.add(`${parsed.baseName}.${parsed.renderer}`)
  }
  return [...names].sort()
}

/**
 * Pick the community template file to eject for a name such as `NuxtSeo` or `NuxtSeo.takumi`.
 * A bare name picks the variant for the renderer the app uses: its existing templates first,
 * then its installed renderer packages, then Takumi, the module default.
 */
export function resolveEjectTemplate(name: string, ctx: EjectContext): EjectResolution {
  const requested = name.replace(/\.vue$/, '')
  const variants = ctx.templateFiles
    .map(file => ({ file, parsed: parseTemplateFile(file) }))
    .filter((v): v is { file: string, parsed: { baseName: string, renderer: EjectRenderer } } => !!v.parsed)

  const exact = variants.find(v => `${v.parsed.baseName}.${v.parsed.renderer}` === requested)
  if (exact)
    return { _tag: 'Ok', file: exact.file, renderer: exact.parsed.renderer, reason: 'exact' }

  const candidates = variants.filter(v => v.parsed.baseName === requested)
  if (candidates.length === 0)
    return { _tag: 'NotFound', name, available: listEjectableNames(ctx.templateFiles) }
  if (candidates.length === 1)
    return { _tag: 'Ok', file: candidates[0]!.file, renderer: candidates[0]!.parsed.renderer, reason: 'only-variant' }

  const pick = (renderers: EjectRenderer[], reason: 'app-templates' | 'installed' | 'default'): EjectResolution | null => {
    for (const renderer of RENDERER_PREFERENCE) {
      if (!renderers.includes(renderer))
        continue
      const match = candidates.find(c => c.parsed.renderer === renderer)
      if (match)
        return { _tag: 'Ok', file: match.file, renderer, reason }
    }
    return null
  }

  // candidates is non-empty and every variant has a preferred renderer, so the last pick always matches
  return pick(ctx.appRenderers, 'app-templates')
    ?? pick(ctx.installedRenderers, 'installed')
    ?? pick(RENDERER_PREFERENCE, 'default')!
}

/** Renderers named by the app's package.json dependencies. */
export function detectInstalledRenderers(pkg: { dependencies?: Record<string, string>, devDependencies?: Record<string, string> } | null): EjectRenderer[] {
  const deps = { ...pkg?.dependencies, ...pkg?.devDependencies }
  return RENDERER_PREFERENCE.filter(r => RENDERER_PACKAGES[r].some(p => p in deps))
}

/** Renderers named by the suffixes of the app's existing OG image templates. */
export function detectAppRenderers(files: string[]): EjectRenderer[] {
  const found = new Set<EjectRenderer>()
  for (const file of files) {
    const parsed = parseTemplateFile(file.split('/').pop() || file)
    if (parsed)
      found.add(parsed.renderer)
  }
  return RENDERER_PREFERENCE.filter(r => found.has(r))
}
