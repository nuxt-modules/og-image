import { describe, expect, it } from 'vitest'
import { AssetTransformPlugin } from '../../src/build/vite-asset-transform'

describe('asset-transform plugin', () => {
  const componentDirs = ['OgImage', 'og-image', 'OgImageTemplate']

  describe('emoji transform', () => {
    const plugin = AssetTransformPlugin.raw({
      emojiSet: 'noto',
      componentDirs,
      rootDir: '/test',
      srcDir: '/test',
      publicDir: '/test/public',
    }, { framework: 'vite' })

    it('should include OgImage components', () => {
      expect(plugin.transformInclude?.('components/OgImage/Test.vue')).toBe(true)
      expect(plugin.transformInclude?.('components/og-image/Test.vue')).toBe(true)
      expect(plugin.transformInclude?.('components/OgImageTemplate/Test.vue')).toBe(true)
    })

    it('should exclude non-OgImage components', () => {
      expect(plugin.transformInclude?.('components/Header.vue')).toBe(false)
      expect(plugin.transformInclude?.('pages/index.vue')).toBe(false)
    })

    it('should exclude node_modules', () => {
      expect(plugin.transformInclude?.('node_modules/some-pkg/OgImage.vue')).toBe(false)
    })

    it('should transform emojis in text content', async () => {
      const code = `<template>
  <div>
    <p>Hello 👋 World</p>
  </div>
</template>`

      const result = await plugin.transform?.(code, 'components/OgImage/Test.vue')
      expect(result).toBeDefined()
      expect(result?.code).toContain('<svg')
      expect(result?.code).not.toContain('👋')
    })

    it('should NOT transform emojis in attributes', async () => {
      const code = `<template>
  <div>
    <img alt="👋 Wave emoji" src="/test.png">
    <p>Hello 👋 World</p>
  </div>
</template>`

      const result = await plugin.transform?.(code, 'components/OgImage/Test.vue')
      expect(result).toBeDefined()
      // Emoji in alt attribute should be preserved
      expect(result?.code).toContain('alt="👋 Wave emoji"')
      // Emoji in text content should be replaced with SVG
      expect(result?.code).toContain('<svg')
    })

    it('should NOT transform dynamic emojis from props/bindings', async () => {
      const code = `<template>
  <div>
    <p>{{ emoji }}</p>
    <p :title="dynamicEmoji">Static 👋 here</p>
  </div>
</template>`

      const result = await plugin.transform?.(code, 'components/OgImage/Test.vue')
      expect(result).toBeDefined()
      // Dynamic bindings should be preserved
      expect(result?.code).toContain('{{ emoji }}')
      expect(result?.code).toContain(':title="dynamicEmoji"')
      // Static emoji in text should still be replaced
      expect(result?.code).toContain('<svg')
    })

    it('should skip files without emojis', async () => {
      const code = `<template>
  <div>
    <p>Hello World</p>
  </div>
</template>`

      const result = await plugin.transform?.(code, 'components/OgImage/Test.vue')
      expect(result).toBeUndefined()
    })

    it('should skip files without template', async () => {
      const code = `<script setup>
const msg = '👋'
</script>`

      const result = await plugin.transform?.(code, 'components/OgImage/Test.vue')
      expect(result).toBeUndefined()
    })

    it('should handle multiple emojis', async () => {
      const code = `<template>
  <div>
    <p>👋 Hello 😀 World</p>
  </div>
</template>`

      const result = await plugin.transform?.(code, 'components/OgImage/Test.vue')
      expect(result).toBeDefined()
      // Should have at least 1 SVG (some emojis may not be in icon set)
      const svgCount = (result?.code.match(/<svg/g) || []).length
      expect(svgCount).toBeGreaterThanOrEqual(1)
    })
  })

  describe('icon transform', () => {
    const plugin = AssetTransformPlugin.raw({
      componentDirs,
      rootDir: '/test',
      srcDir: '/test',
      publicDir: '/test/public',
    }, { framework: 'vite' })

    it('should transform Icon components to inline SVG', async () => {
      const code = `<template>
  <div>
    <Icon name="tabler:star" class="w-6 h-6" />
  </div>
</template>`

      const result = await plugin.transform?.(code, 'components/OgImage/Test.vue')
      expect(result).toBeDefined()
      expect(result?.code).toContain('<svg')
      expect(result?.code).toContain('viewBox')
      expect(result?.code).not.toContain('<Icon')
    })

    it('should transform UIcon components to inline SVG', async () => {
      const code = `<template>
  <div>
    <UIcon name="tabler:heart" />
  </div>
</template>`

      const result = await plugin.transform?.(code, 'components/OgImage/Test.vue')
      expect(result).toBeDefined()
      expect(result?.code).toContain('<svg')
      expect(result?.code).not.toContain('<UIcon')
    })

    it('should preserve other attributes on icon', async () => {
      const code = `<template>
  <div>
    <Icon name="tabler:star" class="text-yellow-500" style="margin: 4px" />
  </div>
</template>`

      const result = await plugin.transform?.(code, 'components/OgImage/Test.vue')
      expect(result).toBeDefined()
      expect(result?.code).toContain('class="text-yellow-500"')
      expect(result?.code).toContain('style="')
    })

    it('should NOT transform dynamic icon names', async () => {
      const code = `<template>
  <div>
    <Icon :name="iconName" />
  </div>
</template>`

      const result = await plugin.transform?.(code, 'components/OgImage/Test.vue')
      // Should return undefined since no static icons to transform
      expect(result).toBeUndefined()
    })

    it('should skip icons with template syntax in name', async () => {
      const code = `<template>
  <div>
    <Icon name="tabler:star" />
    <Icon :name="\`tabler:\${type}\`" />
  </div>
</template>`

      const result = await plugin.transform?.(code, 'components/OgImage/Test.vue')
      expect(result).toBeDefined()
      // Static icon should be transformed
      expect(result?.code).toContain('<svg')
      // Dynamic icon should remain
      expect(result?.code).toContain('<Icon :name=')
    })
  })

  describe('image transform', () => {
    const plugin = AssetTransformPlugin.raw({
      componentDirs,
      rootDir: '/home/harlan/pkg/og-image/test/fixtures/build-transforms',
      srcDir: '/home/harlan/pkg/og-image/test/fixtures/build-transforms',
      publicDir: '/home/harlan/pkg/og-image/test/fixtures/build-transforms/public',
    }, { framework: 'vite' })

    it('should inline public directory images', async () => {
      const code = `<template>
  <div>
    <img src="/images/test.png" alt="Test" />
  </div>
</template>`

      const result = await plugin.transform?.(code, '/home/harlan/pkg/og-image/test/fixtures/build-transforms/components/OgImage/Test.vue')
      expect(result).toBeDefined()
      expect(result?.code).toContain('data:image/png;base64,')
      expect(result?.code).not.toContain('src="/images/test.png"')
    })

    it('should inline ~/assets images', async () => {
      const code = `<template>
  <div>
    <img src="~/assets/logo.png" alt="Logo" />
  </div>
</template>`

      const result = await plugin.transform?.(code, '/home/harlan/pkg/og-image/test/fixtures/build-transforms/components/OgImage/Test.vue')
      expect(result).toBeDefined()
      expect(result?.code).toContain('data:image/png;base64,')
      expect(result?.code).not.toContain('src="~/assets/logo.png"')
    })

    it('should inline @/assets images', async () => {
      const code = `<template>
  <div>
    <img src="@/assets/logo.png" alt="Logo" />
  </div>
</template>`

      const result = await plugin.transform?.(code, '/home/harlan/pkg/og-image/test/fixtures/build-transforms/components/OgImage/Test.vue')
      expect(result).toBeDefined()
      expect(result?.code).toContain('data:image/png;base64,')
      expect(result?.code).not.toContain('src="@/assets/logo.png"')
    })

    it('should NOT inline images with data-no-inline attribute', async () => {
      const code = `<template>
  <div data-no-inline>
    <img src="/images/test.png" alt="Test" />
  </div>
</template>`

      const result = await plugin.transform?.(code, '/home/harlan/pkg/og-image/test/fixtures/build-transforms/components/OgImage/Test.vue')
      // Should return undefined since transform is skipped
      expect(result).toBeUndefined()
    })

    it('should NOT inline external URLs', async () => {
      const code = `<template>
  <div>
    <img src="https://example.com/image.png" alt="External" />
  </div>
</template>`

      const result = await plugin.transform?.(code, '/home/harlan/pkg/og-image/test/fixtures/build-transforms/components/OgImage/Test.vue')
      // Should return undefined since no local images to transform
      expect(result).toBeUndefined()
    })

    it('should NOT inline bound src attributes', async () => {
      const code = `<template>
  <div>
    <img :src="imagePath" alt="Dynamic" />
  </div>
</template>`

      const result = await plugin.transform?.(code, '/home/harlan/pkg/og-image/test/fixtures/build-transforms/components/OgImage/Test.vue')
      // Should return undefined since :src is a binding
      expect(result).toBeUndefined()
    })

    it('should handle multiple image sources', async () => {
      const code = `<template>
  <div>
    <img src="/images/test.png" alt="Public" />
    <img src="~/assets/logo.png" alt="Assets" />
  </div>
</template>`

      const result = await plugin.transform?.(code, '/home/harlan/pkg/og-image/test/fixtures/build-transforms/components/OgImage/Test.vue')
      expect(result).toBeDefined()
      // Should have 2 base64 images
      const base64Count = (result?.code.match(/data:image\/png;base64,/g) || []).length
      expect(base64Count).toBe(2)
    })
  })
})
