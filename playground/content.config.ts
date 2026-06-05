import { defineCollection, defineContentConfig } from '@nuxt/content'
import { z } from 'zod'
import { defineOgImageSchema } from '../src/content'

export default defineContentConfig({
  collections: {
    content: defineCollection({
      type: 'page',
      source: '**/*.md',
      schema: z.object({
        date: z.string().optional(),
        ogImage: defineOgImageSchema(),
      }),
    }),
  },
})
