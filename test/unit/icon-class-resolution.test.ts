import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { clearUnoCache, createUnoProvider, setUnoConfig, setUnoRootDir } from '../../src/build/css/providers/uno'
import { AssetTransformPlugin } from '../../src/build/vite-asset-transform'

// ============================================================================
// resolveIcon: UnoCSS presetIcons custom collections
// ============================================================================

describe('unoCSS resolveIcon', () => {
  const customIcons: Record<string, string> = {
    'agent-skills': '<svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M16 0.5L29.4234 8.25V23.75L16 31.5L2.57661 23.75V8.25L16 0.5Z" fill="currentColor"/></svg>',
    'star': '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M12 2l3 7h7l-5.5 4.5L18 21l-6-4-6 4 1.5-7.5L2 9h7z" fill="currentColor"/></svg>',
  }

  let resolveIcon: (prefix: string, name: string) => Promise<{ body: string, width: number, height: number } | null>

  beforeAll(async () => {
    const presetWind4 = await import('@unocss/preset-wind4')
    const presetIcons = await import('@unocss/preset-icons')
    clearUnoCache()
    setUnoRootDir('/tmp/og-image-icon-test')
    setUnoConfig({
      presets: [
        presetWind4.default(),
        presetIcons.default({
          collections: {
            custom: customIcons,
          },
        }),
      ],
    })
    const provider = createUnoProvider()
    resolveIcon = (prefix, name) => provider.resolveIcon!(prefix, name)
  })

  afterAll(() => {
    clearUnoCache()
  })

  it('resolves a custom icon by prefix and name', async () => {
    const result = await resolveIcon('custom', 'agent-skills')
    expect(result).not.toBeNull()
    expect(result!.body).toContain('<path')
    expect(result!.width).toBe(32)
    expect(result!.height).toBe(32)
  })

  it('resolves another custom icon', async () => {
    const result = await resolveIcon('custom', 'star')
    expect(result).not.toBeNull()
    expect(result!.body).toContain('<path')
    expect(result!.width).toBe(24)
    expect(result!.height).toBe(24)
  })

  it('returns null for nonexistent icon', async () => {
    const result = await resolveIcon('custom', 'nonexistent-icon')
    expect(result).toBeNull()
  })

  it('returns null for nonexistent collection', async () => {
    const result = await resolveIcon('fakecollection', 'star')
    expect(result).toBeNull()
  })

  it('resolves an @iconify-json icon (e.g. tabler:star)', async () => {
    // This depends on @iconify-json/tabler being installed
    const result = await resolveIcon('tabler', 'star')
    if (result) {
      expect(result.body).toContain('<path')
      expect(result.width).toBeGreaterThan(0)
      expect(result.height).toBeGreaterThan(0)
    }
  })

  it('cSS provider resolves icon CSS (filtering happens in asset transform)', async () => {
    // resolveClassesToStyles returns raw CSS — the asset transform filters icon classes
    // before calling it. This test verifies the provider CAN generate icon CSS.
    const provider = createUnoProvider()
    const result = await provider.resolveClassesToStyles(['i-custom-agent-skills'])
    const styles = result['i-custom-agent-skills']
    // UnoCSS generates mask-based styles for icons
    expect(styles).toBeDefined()
  })
})

// ============================================================================
// Asset transform: icon class → inline SVG
// ============================================================================

describe('asset-transform icon class replacement', () => {
  const ogComponentPaths = ['/test/components/OgImage']

  let plugin: ReturnType<typeof AssetTransformPlugin.raw>

  beforeAll(async () => {
    const presetWind4 = await import('@unocss/preset-wind4')
    const presetIcons = await import('@unocss/preset-icons')
    clearUnoCache()
    setUnoRootDir('/tmp/og-image-icon-transform-test')
    setUnoConfig({
      presets: [
        presetWind4.default(),
        presetIcons.default({
          collections: {
            custom: {
              star: '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M12 2l3 7h7l-5.5 4.5L18 21l-6-4-6 4 1.5-7.5L2 9h7z" fill="currentColor"/></svg>',
            },
          },
        }),
      ],
    })

    const provider = createUnoProvider()

    plugin = AssetTransformPlugin.raw({
      ogComponentPaths,
      rootDir: '/test',
      srcDir: '/test',
      publicDir: '/test/public',
      cssProvider: provider,
    }, { framework: 'vite' })
  })

  afterAll(() => {
    clearUnoCache()
  })

  it('replaces i-{prefix}-{name} class with inline SVG', async () => {
    const code = `<template>
  <div>
    <div class="i-custom-star" />
  </div>
</template>`

    const result = await plugin.transform?.(code, '/test/components/OgImage/Test.vue')
    expect(result).toBeDefined()
    expect(result?.code).toContain('<svg')
    expect(result?.code).toContain('viewBox')
    expect(result?.code).not.toContain('i-custom-star')
  })

  it('preserves non-icon classes on the wrapper (resolved to styles by CSS provider)', async () => {
    const code = `<template>
  <div>
    <span class="i-custom-star text-xl text-blue-500" />
  </div>
</template>`

    const result = await plugin.transform?.(code, '/test/components/OgImage/Test.vue')
    expect(result).toBeDefined()
    expect(result?.code).toContain('<svg')
    expect(result?.code).not.toContain('i-custom-star')
    // Non-icon classes get resolved to inline styles by the CSS provider
    // text-xl → font-size, text-blue-500 → color
    expect(result?.code).toContain('font-size')
    expect(result?.code).toMatch(/color/)
  })

  it('preserves v-if directives on sibling elements', async () => {
    const code = `<template>
  <div>
    <span v-if="showIcon" class="text-lg">Visible</span>
    <span v-else class="text-sm">Hidden</span>
    <div class="i-custom-star" />
  </div>
</template>`

    const result = await plugin.transform?.(code, '/test/components/OgImage/Test.vue')
    expect(result).toBeDefined()
    expect(result?.code).toContain('<svg')
    // Vue directives must be preserved (not mangled by ultrahtml)
    expect(result?.code).toContain('v-if="showIcon"')
    expect(result?.code).toContain('v-else')
  })

  it('preserves v-if on the icon element itself', async () => {
    const code = `<template>
  <div>
    <div v-if="hasIcon" class="i-custom-star" />
  </div>
</template>`

    const result = await plugin.transform?.(code, '/test/components/OgImage/Test.vue')
    expect(result).toBeDefined()
    expect(result?.code).toContain('<svg')
    expect(result?.code).toContain('v-if="hasIcon"')
  })

  it('handles empty paired tags', async () => {
    const code = `<template>
  <div>
    <div class="i-custom-star"></div>
  </div>
</template>`

    const result = await plugin.transform?.(code, '/test/components/OgImage/Test.vue')
    expect(result).toBeDefined()
    expect(result?.code).toContain('<svg')
    expect(result?.code).not.toContain('i-custom-star')
  })

  it('preserves style attribute on icon element', async () => {
    const code = `<template>
  <div>
    <span class="i-custom-star" style="color: red; font-size: 2rem" />
  </div>
</template>`

    const result = await plugin.transform?.(code, '/test/components/OgImage/Test.vue')
    expect(result).toBeDefined()
    expect(result?.code).toContain('<svg')
    // buildIconSvg merges existing style with display:flex
    expect(result?.code).toContain('color: red')
    expect(result?.code).toContain('font-size: 2rem')
  })

  it('skips nonexistent icon classes (no replacement)', async () => {
    const code = `<template>
  <div>
    <div class="i-custom-nonexistent" />
  </div>
</template>`

    const result = await plugin.transform?.(code, '/test/components/OgImage/Test.vue')
    // No replacement possible, no other transforms → undefined
    expect(result).toBeUndefined()
  })

  it('does not match non-icon i- classes as icons', async () => {
    const code = `<template>
  <div>
    <div class="italic inline" />
  </div>
</template>`

    const result = await plugin.transform?.(code, '/test/components/OgImage/Test.vue')
    // "italic" and "inline" start with "i" but don't match i-{prefix}-{name} pattern.
    // CSS provider may still resolve them as utilities, but they must NOT become SVGs.
    if (result) {
      expect(result.code).not.toContain('<svg')
    }
  })
})
