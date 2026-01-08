import type { Collection } from '@nuxt/content'
import { z } from 'zod'

export const ogImageSchema = z.object({
  url: z.string().optional(),
  component: z.string().optional(),
  props: z.record(z.string(), z.any()),
}).optional()

export const schema = z.object({
  ogImage: ogImageSchema,
})

export function asOgImageCollection(collection: Collection): Collection {
  if (collection.type === 'page') {
    collection.schema = collection.schema ? schema.extend(collection.schema.shape) : schema
  }
  return collection
}
