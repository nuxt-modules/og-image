import type { Collection } from '@nuxt/content'
import type { TypeOf, ZodRawShape } from 'zod'
import { z } from '@nuxt/content'

export const ogImageSchema = z.object({
  url: z.string().optional(),
  component: z.string().optional(),
  props: z.record(z.string(), z.any()),
}).optional()

export const schema = z.object({
  ogImage: ogImageSchema,
})

export type OgImageSchema = TypeOf<typeof schema>

type ExtendedSchema<T extends ZodRawShape> = T & {
  ogImage: typeof ogImageSchema
}

export function asOgImageCollection<T extends ZodRawShape>(collection: Collection<T>): Collection<ExtendedSchema<T>> {
  if (collection.type === 'page') {
    // @ts-expect-error untyped
    collection.schema = collection.schema ? schema.extend(collection.schema.shape) : schema
  }
  return collection as Collection<ExtendedSchema<T>>
}
