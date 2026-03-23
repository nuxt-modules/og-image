import type { Collection } from '@nuxt/content'
import { z } from 'zod'

function buildOgImageObjectSchema(_z: typeof z) {
  return _z.object({
    url: _z.string().optional(),
    component: _z.string().optional(),
    props: _z.record(_z.string(), _z.any()),
  }).optional()
}

const ogImageObjectSchema = buildOgImageObjectSchema(z)

function withEditorHidden<T extends z.ZodTypeAny>(s: T): T {
  // .editor() is patched onto ZodType by @nuxt/content at runtime
  if (typeof (s as any).editor === 'function')
    return (s as any).editor({ hidden: true })
  return s
}

export interface DefineOgImageSchemaOptions {
  /**
   * Pass the `z` instance from `@nuxt/content` to ensure `.editor({ hidden: true })` works
   * across Zod versions. When omitted, the bundled `z` is used (`.editor()` applied if available).
   */
  z?: typeof z
}

/**
 * Define the ogImage schema field for a Nuxt Content collection.
 *
 * @example
 * defineCollection({
 *   type: 'page',
 *   source: '**',
 *   schema: z.object({
 *     ogImage: defineOgImageSchema()
 *   })
 * })
 */
export function defineOgImageSchema(options?: DefineOgImageSchemaOptions) {
  const s = options?.z ? buildOgImageObjectSchema(options.z) : ogImageObjectSchema
  return withEditorHidden(s)
}

// Legacy exports
export const ogImageSchema = ogImageObjectSchema

export const schema = z.object({
  ogImage: withEditorHidden(ogImageObjectSchema),
})

/** @deprecated Use `defineOgImageSchema()` in your collection schema instead. See https://nuxtseo.com/og-image/integrations/content */
export function asOgImageCollection<T>(collection: Collection<T>): Collection<T> {
  console.warn('[og-image] `asOgImageCollection()` is deprecated. Use `defineOgImageSchema()` in your collection schema instead. See https://nuxtseo.com/og-image/integrations/content')
  if (collection.type === 'page') {
    // @ts-expect-error untyped
    collection.schema = collection.schema ? schema.extend(collection.schema.shape) : schema
  }
  return collection
}
