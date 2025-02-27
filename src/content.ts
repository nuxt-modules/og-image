import type { Collection } from '@nuxt/content'
import type { TypeOf, ZodRawShape } from 'zod'
import { z } from '@nuxt/content'

export const schema = z.object({
  ogImage: z.object({
    url: z.string().optional(),
    component: z.string().optional(),
    props: z.record(z.string(), z.any()),
  }).optional(),
})

export type OgImageSchema = TypeOf<typeof schema>

export function asOgImageCollection<T extends ZodRawShape>(collection: Collection<T>): Collection<T> {
  if (collection.type === 'page') {
    // @ts-expect-error untyped
    collection.schema = collection.schema ? schema.extend(collection.schema.shape) : schema
  }
  return collection
}
