import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'pathe'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { AssetTransformPlugin } from '../../src/build/vite-asset-transform'

const testDir = join(__dirname, '__fixtures__')
const publicDir = join(testDir, 'public')
const srcDir = join(testDir, 'src')
const componentDir = join(srcDir, 'components', 'OgImage')

describe('asset-transform plugin', () => {
  const ogComponentPaths = [
    join(srcDir, 'components', 'OgImage'),
    join(srcDir, 'components', 'og-image'),
    join(srcDir, 'components', 'OgImageTemplate'),
  ]
  const plugin = AssetTransformPlugin.raw({
    ogComponentPaths,
    rootDir: testDir,
    srcDir,
    publicDir,
  }, { framework: 'vite' })

  beforeAll(() => {
    mkdirSync(publicDir, { recursive: true })
    mkdirSync(join(srcDir, 'assets'), { recursive: true })
    mkdirSync(componentDir, { recursive: true })

    writeFileSync(join(publicDir, 'logo.png'), Buffer.from([0x89, 0x50, 0x4E, 0x47]))
    writeFileSync(join(publicDir, 'icon.svg'), '<svg xmlns="http://www.w3.org/2000/svg"><circle r="10"/></svg>')
    writeFileSync(join(srcDir, 'assets', 'logo.svg'), '<svg xmlns="http://www.w3.org/2000/svg"><rect width="10" height="10"/></svg>')
  })

  afterAll(() => {
    if (existsSync(testDir))
      rmSync(testDir, { recursive: true })
  })

  // Transform include tests
  it('should include OgImage components', () => {
    expect(plugin.transformInclude?.(join(srcDir, 'components', 'OgImage', 'Test.vue'))).toBe(true)
    expect(plugin.transformInclude?.(join(srcDir, 'components', 'og-image', 'Test.vue'))).toBe(true)
    expect(plugin.transformInclude?.(join(srcDir, 'components', 'OgImageTemplate', 'Test.vue'))).toBe(true)
  })

  it('should exclude non-OgImage components', () => {
    expect(plugin.transformInclude?.(join(srcDir, 'components', 'Header.vue'))).toBe(false)
    expect(plugin.transformInclude?.(join(srcDir, 'pages', 'index.vue'))).toBe(false)
  })

  it('should exclude node_modules', () => {
    expect(plugin.transformInclude?.('node_modules/some-pkg/OgImage.vue')).toBe(false)
  })

  // Icon transform tests
  it('should transform Icon component to inline SVG', async () => {
    const code = `<template>
  <div>
    <Icon name="carbon:home" />
  </div>
</template>`

    const result = await plugin.transform?.(code, join(componentDir, 'Test.vue'))
    expect(result).toBeDefined()
    expect(result?.code).toContain('<svg')
    expect(result?.code).not.toContain('<Icon')
  })

  it('should transform UIcon component to inline SVG', async () => {
    const code = `<template>
  <div>
    <UIcon name="carbon:settings" />
  </div>
</template>`

    const result = await plugin.transform?.(code, join(componentDir, 'Test.vue'))
    expect(result).toBeDefined()
    expect(result?.code).toContain('<svg')
    expect(result?.code).not.toContain('<UIcon')
  })

  it('should preserve class and style attributes on icons', async () => {
    const code = `<template>
  <div>
    <Icon name="carbon:home" class="text-xl text-blue-500" style="color: red" />
  </div>
</template>`

    const result = await plugin.transform?.(code, join(componentDir, 'Test.vue'))
    expect(result).toBeDefined()
    expect(result?.code).toContain('class="text-xl text-blue-500"')
    expect(result?.code).toContain('style="color: red"')
  })

  it('should skip dynamic icon names', async () => {
    const code = `<template>
  <div>
    <Icon :name="dynamicIcon" />
    <Icon name="carbon:home" />
  </div>
</template>`

    const result = await plugin.transform?.(code, join(componentDir, 'Test.vue'))
    expect(result).toBeDefined()
    expect(result?.code).toContain('<Icon :name="dynamicIcon"')
    expect(result?.code).toContain('<svg')
  })

  it('should handle multiple icons', async () => {
    const code = `<template>
  <div>
    <Icon name="carbon:home" />
    <Icon name="carbon:settings" />
    <UIcon name="carbon:user" />
  </div>
</template>`

    const result = await plugin.transform?.(code, join(componentDir, 'Test.vue'))
    expect(result).toBeDefined()
    const svgCount = (result?.code.match(/<svg/g) || []).length
    expect(svgCount).toBe(3)
  })

  // Image transform tests
  it('should transform public directory images', async () => {
    const code = `<template>
  <div>
    <img src="/logo.png" alt="Logo" />
  </div>
</template>`

    const result = await plugin.transform?.(code, join(componentDir, 'Test.vue'))
    expect(result).toBeDefined()
    expect(result?.code).toContain('data:image/png;base64,')
    expect(result?.code).not.toContain('src="/logo.png"')
  })

  it('should inline SVGs with URL encoding', async () => {
    const code = `<template>
  <div>
    <img src="/icon.svg" alt="Icon" />
  </div>
</template>`

    const result = await plugin.transform?.(code, join(componentDir, 'Test.vue'))
    expect(result).toBeDefined()
    expect(result?.code).toContain('data:image/svg+xml,')
    expect(result?.code).not.toContain('src="/icon.svg"')
  })

  it('should transform ~/ alias paths', async () => {
    const code = `<template>
  <div>
    <img src="~/assets/logo.svg" alt="Logo" />
  </div>
</template>`

    const result = await plugin.transform?.(code, join(componentDir, 'Test.vue'))
    expect(result).toBeDefined()
    expect(result?.code).toContain('data:image/svg+xml,')
  })

  it('should transform @/ alias paths', async () => {
    const code = `<template>
  <div>
    <img src="@/assets/logo.svg" alt="Logo" />
  </div>
</template>`

    const result = await plugin.transform?.(code, join(componentDir, 'Test.vue'))
    expect(result).toBeDefined()
    expect(result?.code).toContain('data:image/svg+xml,')
  })

  it('should skip dynamic src bindings', async () => {
    const code = `<template>
  <div>
    <img :src="dynamicSrc" alt="Dynamic" />
    <img src="/logo.png" alt="Static" />
  </div>
</template>`

    const result = await plugin.transform?.(code, join(componentDir, 'Test.vue'))
    expect(result).toBeDefined()
    expect(result?.code).toContain(':src="dynamicSrc"')
    expect(result?.code).toContain('data:image/png;base64,')
  })

  it('should skip files with data-no-inline attribute', async () => {
    const code = `<template>
  <div data-no-inline>
    <img src="/logo.png" alt="Logo" />
  </div>
</template>`

    const result = await plugin.transform?.(code, join(componentDir, 'Test.vue'))
    expect(result).toBeUndefined()
  })

  // Combined transform tests
  it('should transform both icons and images in same component', async () => {
    const code = `<template>
  <div>
    <Icon name="carbon:home" />
    <img src="/logo.png" alt="Logo" />
  </div>
</template>`

    const result = await plugin.transform?.(code, join(componentDir, 'Test.vue'))
    expect(result).toBeDefined()
    expect(result?.code).toContain('<svg')
    expect(result?.code).toContain('data:image/png;base64,')
  })

  it('should skip files without icons or images', async () => {
    const code = `<template>
  <div>
    <p>Hello World</p>
  </div>
</template>`

    const result = await plugin.transform?.(code, join(componentDir, 'Test.vue'))
    expect(result).toBeUndefined()
  })

  it('should skip files without template', async () => {
    const code = `<script setup>
const icon = 'carbon:home'
</script>`

    const result = await plugin.transform?.(code, join(componentDir, 'Test.vue'))
    expect(result).toBeUndefined()
  })
})
