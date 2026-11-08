/**
 * Every meta tag that `generateMeta()` can return, by its `property` or `name`. Each has a fixed
 * dynamic value index: its position here.
 */
export const OG_META_IDENTITIES = [
  'twitter:card',
  'twitter:image',
  'og:image',
  'og:image:type',
  'og:image:width',
  'og:image:height',
  'og:image:alt',
  'twitter:image:alt',
] as const

export type OgMetaIdentity = typeof OG_META_IDENTITIES[number]

/**
 * The entry options of each og:image `useHead()` call, which compiled tags hold in each tag:
 * the server entry of `defineOgImage()` and the client entry of a component URL process
 * template params, and the other entries take none.
 */
export const OG_META_MODES = {
  template: { processTemplateParams: true },
  plain: {},
} as const

export type OgMetaMode = keyof typeof OG_META_MODES

export type MetaShapes = Record<OgMetaMode, Partial<Record<OgMetaIdentity, unknown[]>>>

/** The priority `generateMeta()` gives each tag: the card type is a default, the image tags outrank fallbacks. */
export function ogMetaPriority(identity: OgMetaIdentity): 'low' | 'high' {
  return identity === 'twitter:card' ? 'low' : 'high'
}

/** The input the build compiles for one meta tag: its content is dynamic value `content`. */
export function ogMetaShapeInput(mode: OgMetaMode, identity: OgMetaIdentity, content: string) {
  const key = identity.startsWith('og:') ? 'property' : 'name'
  return { meta: [{ [key]: identity, content, tagPriority: ogMetaPriority(identity), ...OG_META_MODES[mode] }] }
}

/** A meta tag of resolvable head input. */
export type OgMeta = Record<string, any>

/** A value compiled tags render as normal input does: a non-empty string other than `'true'`, or a finite number other than `0`. */
export function isText(value: unknown): value is string | number {
  return typeof value === 'string' ? !!value && value !== 'true' : typeof value === 'number' && Number.isFinite(value) && value !== 0
}

export type CompiledMeta
  = | { _tag: 'Compiled', tags: unknown[], values: unknown[] }
    | { _tag: 'Loose', reason: string }

// Lists of meta are few: one per mix of image key, width, height, and alt. So each concatenation
// is cached, and the render memo sees one set of compiled tags per list.
const concatenated = new Map<string, unknown[]>()

/**
 * The compiled tags of a meta list from `generateMeta()`, with its resolved content as values.
 * A list that repeats an identity, or content that compiled tags render differently, stays
 * normal input.
 */
export function compileOgMeta(shapes: MetaShapes, mode: OgMetaMode, meta: OgMeta[]): CompiledMeta {
  const values: unknown[] = OG_META_IDENTITIES.map(() => 'unused')
  const identities: OgMetaIdentity[] = []
  for (const tag of meta) {
    const identity = (tag.property || tag.name) as OgMetaIdentity
    const index = OG_META_IDENTITIES.indexOf(identity)
    if (index < 0 || identities.includes(identity))
      return { _tag: 'Loose', reason: `meta ${identity} has no compiled tag of its own` }
    if (tag.tagPriority !== ogMetaPriority(identity))
      return { _tag: 'Loose', reason: `meta ${identity} has another priority` }
    if (!isText(tag.content))
      return { _tag: 'Loose', reason: `meta ${identity} holds no text` }
    identities.push(identity)
    values[index] = tag.content
  }
  const cacheKey = `${mode}:${identities.join()}`
  let tags = concatenated.get(cacheKey)
  if (!tags)
    concatenated.set(cacheKey, tags = identities.flatMap(identity => shapes[mode][identity]!))
  return { _tag: 'Compiled', tags, values }
}

/** The tags of a meta list, keeping the identities and dropping the content. */
export function metaIdentities(meta: OgMeta[]): string {
  return meta.map(tag => tag.property || tag.name).join()
}

const IMAGE_META = (meta: OgMeta) => meta.property === 'og:image' || meta.name === 'twitter:image'

export type ImageRewrite
  = | { _tag: 'Same' }
    | { _tag: 'Rewrite', input: Record<string, unknown> }
    | { _tag: 'Plugin', reason: string }

/**
 * Rewrites the image meta of resolved head input, as the canonical URLs hook does once tags
 * resolve: spaces become `+`, and a URL without `http://` or `https://` takes the site URL. Content with a `%`
 * may hold a template param or the `%title` placeholder, which only resolved tags decide, and
 * empty content drops the tag only if it wins. Both return `Plugin`, so the hook runs.
 */
export function rewriteImageMeta(input: Record<string, unknown>, withSiteUrl: (path: string) => string): ImageRewrite {
  const meta = Array.isArray(input.meta) ? input.meta as OgMeta[] : input.meta ? [input.meta as OgMeta] : []
  let changed = false
  const next: OgMeta[] = []
  for (const tag of meta) {
    if (!tag || typeof tag !== 'object' || !IMAGE_META(tag)) {
      next.push(tag)
      continue
    }
    if (typeof tag.content !== 'string' || !tag.content)
      return { _tag: 'Plugin', reason: 'an image meta tag has no content' }
    if (tag.content.includes('%'))
      return { _tag: 'Plugin', reason: 'an image meta tag holds a %' }
    if (tag.content.includes('\u0000'))
      return { _tag: 'Plugin', reason: 'an image meta tag holds a value that has not settled' }
    const content = rewriteImageUrl(tag.content, withSiteUrl)
    changed ||= content !== tag.content
    next.push(content === tag.content ? tag : { ...tag, content })
  }
  return changed ? { _tag: 'Rewrite', input: { ...input, meta: next } } : { _tag: 'Same' }
}

/** The canonical URLs hook for one URL with no `%`. */
export function rewriteImageUrl(url: string, withSiteUrl: (path: string) => string): string {
  const content = url.replaceAll(' ', '+')
  return /^https?:\/\//.test(content) ? content : withSiteUrl(content)
}
