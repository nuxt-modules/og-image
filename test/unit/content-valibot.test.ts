import { safeParse } from 'valibot'
import { describe, expect, it } from 'vitest'
import { defineOgImageSchema } from '../../src/content-valibot'

describe('defineOgImageSchema', () => {
  it('preserves arbitrary component props', () => {
    const value = { component: 'Blog', props: { title: 'Hello', tags: ['news'], featured: true } }
    expect(safeParse(defineOgImageSchema(), value)).toMatchObject({ success: true, output: value })
  })

  it('rejects an invalid component name', () => {
    expect(safeParse(defineOgImageSchema(), { component: 42, props: {} }).success).toBe(false)
  })
})
