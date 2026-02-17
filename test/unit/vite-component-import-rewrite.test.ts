import type { Component } from '@nuxt/schema'
import { describe, expect, it } from 'vitest'
import { ComponentImportRewritePlugin } from '../../src/build/vite-component-import-rewrite'

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

describe('component-import-rewrite plugin', () => {
  describe('transformInclude', () => {
    const plugin = createPlugin()

    it('includes OG template files', () => {
      expect(plugin.transformInclude?.('/app/components/OgImage/Test.vue')).toBe(true)
    })

    it('excludes non-OG files', () => {
      expect(plugin.transformInclude?.('/app/components/Other/Test.vue')).toBe(false)
    })

    it('includes ?og-image files (depth 0)', () => {
      expect(plugin.transformInclude?.('/app/components/Og/OgBase.vue?og-image')).toBe(true)
    })

    it('includes ?og-image-depth=1 files', () => {
      expect(plugin.transformInclude?.('/app/components/Og/OgBase.vue?og-image-depth=1')).toBe(true)
    })

    it('includes ?og-image-depth=4 files (under limit)', () => {
      expect(plugin.transformInclude?.('/app/components/Og/OgBase.vue?og-image-depth=4')).toBe(true)
    })

    it('excludes ?og-image-depth=5 files (at limit)', () => {
      expect(plugin.transformInclude?.('/app/components/Og/OgBase.vue?og-image-depth=5')).toBe(false)
    })
  })

  describe('transform', () => {
    const plugin = createPlugin()

    it('injects ?og-image-depth=1 imports for top-level OG templates', () => {
      const code = `<template>
  <div>
    <OgBase>Hello</OgBase>
  </div>
</template>`

      const result = plugin.transform?.(code, '/app/components/OgImage/Test.vue')
      expect(result).toBeDefined()
      expect(result?.code).toContain(`import OgBase from '/app/components/Og/OgBase.vue?og-image-depth=1'`)
    })

    it('cascades imports with incremented depth for ?og-image files', () => {
      const code = `<template>
  <div>
    <OgTitle>Hello</OgTitle>
  </div>
</template>`

      const result = plugin.transform?.(code, '/app/components/Og/OgBase.vue?og-image-depth=1')
      expect(result).toBeDefined()
      expect(result?.code).toContain(`import OgTitle from '/app/components/Og/OgTitle.vue?og-image-depth=2'`)
    })

    it('skips files without components', () => {
      const code = `<template>
  <div class="text-red">Hello</div>
</template>`

      const result = plugin.transform?.(code, '/app/components/OgImage/Test.vue')
      expect(result).toBeUndefined()
    })

    it('skips Icon/UIcon components', () => {
      const code = `<template>
  <div>
    <Icon name="test" />
  </div>
</template>`

      const result = plugin.transform?.(code, '/app/components/OgImage/Test.vue')
      expect(result).toBeUndefined()
    })

    it('creates script setup block when none exists', () => {
      const code = `<template>
  <div>
    <OgTitle>Hello</OgTitle>
  </div>
</template>`

      const result = plugin.transform?.(code, '/app/components/OgImage/Test.vue')
      expect(result).toBeDefined()
      expect(result?.code).toContain('<script setup>')
      expect(result?.code).toContain(`import OgTitle from '/app/components/Og/OgTitle.vue?og-image-depth=1'`)
    })
  })
})
