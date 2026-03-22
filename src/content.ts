import { createContentSchemaFactory } from 'nuxtseo-shared/content'
import { z } from 'zod'

const { defineSchema, asCollection, schema } = createContentSchemaFactory({
  fieldName: 'ogImage',
  label: 'og-image',
  docsUrl: 'https://nuxtseo.com/og-image/integrations/content',
  buildSchema: _z => _z.object({
    url: _z.string().optional(),
    component: _z.string().optional(),
    props: _z.record(_z.string(), _z.any()),
  }).optional(),
}, z)

export { asCollection as asOgImageCollection, defineSchema as defineOgImageSchema, schema }

// Legacy exports
export const ogImageSchema = schema.shape.ogImage
