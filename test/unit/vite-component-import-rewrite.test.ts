import type { Component } from '@nuxt/schema'
import { describe, expect, it } from 'vitest'
import { ComponentImportRewritePlugin } from '../../src/build/vite-component-import-rewrite'
import { runTransform } from '../unplugin'

const mockComponents: Component[] = [
  { pascalName: 'OgBase', kebabName: 'og-base', filePath: '/app/components/Og/OgBase.vue' },
  { pascalName: 'OgTitle', kebabName: 'og-title', filePath: '/app/components/Og/OgTitle.vue' },
] as Component[]

const ogComponentPaths = ['/app/components/OgImage']

function createPlugin() {
  return ComponentImportRewritePlugin.raw({
    ogComponentPaths,
    getComponents: () => mockComponents,
  }, { framework: 'vite' })
}

const NESTED_TEMPLATE = `<template>
  <div>
    <OgTitle>Hello</OgTitle>
  </div>
</template>`

describe('component-import-rewrite plugin', () => {
  describe('module scope', () => {
    const plugin = createPlugin()

    it.each([
      '/app/components/OgImage/Test.vue',
      '/app/components/Og/OgBase.vue?og-image',
      '/app/components/Og/OgBase.vue?og-image-depth=1',
      '/app/components/Og/OgBase.vue?og-image-depth=4',
    ])('rewrites %s', async (id) => {
      expect(await runTransform(plugin, NESTED_TEMPLATE, id)).toBeDefined()
    })

    it.each([
      // Outside every OG template directory.
      '/app/components/Other/Test.vue',
      // At the cascade depth limit.
      '/app/components/Og/OgBase.vue?og-image-depth=5',
      // SFC blocks never carry the query and are not ours to rewrite.
      '/app/components/OgImage/Test.vue?vue&type=style&index=0&lang.css',
      '/app/components/OgImage/Test.vue?nuxt_component=async',
      // Not a Vue file at all.
      '/app/components/OgImage/Test.ts',
    ])('leaves %s alone', async (id) => {
      expect(await runTransform(plugin, NESTED_TEMPLATE, id)).toBeUndefined()
    })
  })

  describe('transform', () => {
    const plugin = createPlugin()

    it('injects ?og-image-depth=1 imports for top-level OG templates', async () => {
      const code = `<template>
  <div>
    <OgBase>Hello</OgBase>
  </div>
</template>`

      const result = await runTransform(plugin, code, '/app/components/OgImage/Test.vue')
      expect(result).toBeDefined()
      expect(result?.code).toContain(`import OgBase from '/app/components/Og/OgBase.vue?og-image-depth=1'`)
    })

    it('cascades imports with incremented depth for ?og-image files', async () => {
      const code = `<template>
  <div>
    <OgTitle>Hello</OgTitle>
  </div>
</template>`

      const result = await runTransform(plugin, code, '/app/components/Og/OgBase.vue?og-image-depth=1')
      expect(result).toBeDefined()
      expect(result?.code).toContain(`import OgTitle from '/app/components/Og/OgTitle.vue?og-image-depth=2'`)
    })

    it('skips files without components', async () => {
      const code = `<template>
  <div class="text-red">Hello</div>
</template>`

      const result = await runTransform(plugin, code, '/app/components/OgImage/Test.vue')
      expect(result).toBeUndefined()
    })

    it('skips Icon/UIcon components', async () => {
      const code = `<template>
  <div>
    <Icon name="test" />
  </div>
</template>`

      const result = await runTransform(plugin, code, '/app/components/OgImage/Test.vue')
      expect(result).toBeUndefined()
    })

    it('creates script setup block when none exists', async () => {
      const code = `<template>
  <div>
    <OgTitle>Hello</OgTitle>
  </div>
</template>`

      const result = await runTransform(plugin, code, '/app/components/OgImage/Test.vue')
      expect(result).toBeDefined()
      expect(result?.code).toContain('<script setup>')
      expect(result?.code).toContain(`import OgTitle from '/app/components/Og/OgTitle.vue?og-image-depth=1'`)
    })
  })
})
