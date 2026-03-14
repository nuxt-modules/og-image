import { createResolver } from '@nuxt/kit'
import { $fetch, setup } from '@nuxt/test-utils/e2e'
import { describe, expect, it } from 'vitest'
import { fetchOgImage } from '../utils'

const { resolve } = createResolver(import.meta.url)

await setup({
  rootDir: resolve('../fixtures/layers'),
  server: true,
  build: true,
})

describe('layers support', () => {
  it('resolves og image component from layer', async () => {
    const image = await fetchOgImage('/layer-template')
    expect(image.length).toBeGreaterThan(0)
  })

  it('resolves og image component from app', async () => {
    const image = await fetchOgImage('/app-template')
    expect(image.length).toBeGreaterThan(0)
  })

  it('debug endpoint shows components from both layer and app', async () => {
    const debug = await $fetch('/_og/debug.json') as { componentNames: Array<{ pascalName: string }> }
    const names = debug.componentNames.map(c => c.pascalName)

    expect(names.some(n => n.includes('LayerTemplate'))).toBe(true)
    expect(names.some(n => n.includes('AppTemplate'))).toBe(true)
  })
})
