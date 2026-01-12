import { describe, expect, it } from 'vitest'
import { emojiTransformPlugin } from '../../src/build/emoji-transform'

describe('emoji-transform plugin', () => {
  const componentDirs = ['OgImage', 'og-image', 'OgImageTemplate']
  const plugin = emojiTransformPlugin.raw({ emojiSet: 'noto', componentDirs }, { framework: 'vite' })

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
