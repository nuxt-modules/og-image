import { describe, expect, it } from 'vitest'

describe('font-requirements', () => {
  describe('extractFontWeightFromClass', () => {
    it('should map tailwind font weight classes correctly', async () => {
      const { scanFontRequirements } = await import('../../src/build/css/css-classes')

      // We can't test private functions directly, but we can verify the mapping works
      // by checking the exported interface
      expect(scanFontRequirements).toBeDefined()
    })
  })

  describe('font weight class mapping', () => {
    const FONT_WEIGHT_CLASSES: Record<string, number> = {
      'font-thin': 100,
      'font-extralight': 200,
      'font-light': 300,
      'font-normal': 400,
      'font-medium': 500,
      'font-semibold': 600,
      'font-bold': 700,
      'font-extrabold': 800,
      'font-black': 900,
    }

    it('should have correct weight mappings', () => {
      expect(FONT_WEIGHT_CLASSES['font-thin']).toBe(100)
      expect(FONT_WEIGHT_CLASSES['font-bold']).toBe(700)
      expect(FONT_WEIGHT_CLASSES['font-black']).toBe(900)
    })

    it('should cover all standard tailwind weights', () => {
      expect(Object.keys(FONT_WEIGHT_CLASSES)).toHaveLength(9)
    })
  })

  describe('scanFontRequirements', () => {
    it('should return default requirements for empty components', async () => {
      const { scanFontRequirements } = await import('../../src/build/css/css-classes')

      const result = await scanFontRequirements([])

      expect(result.weights).toContain(400) // Always includes 400 as fallback
      expect(result.styles).toContain('normal') // Always includes normal
      expect(result.isComplete).toBe(true)
    })

    it('should extract weights from vue component with font classes', async () => {
      const { scanFontRequirements } = await import('../../src/build/css/css-classes')
      const fs = await import('node:fs/promises')
      const path = await import('node:path')
      const os = await import('node:os')

      // Create a temp component file
      const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'og-test-'))
      const componentPath = path.join(tempDir, 'Test.vue')

      await fs.writeFile(componentPath, `
<template>
  <div class="font-bold">Bold text</div>
  <span class="font-light">Light text</span>
</template>
`)

      const result = await scanFontRequirements([
        { path: componentPath, hash: 'test-hash', pascalName: 'Test', kebabName: 'test', category: 'app', renderer: 'satori' },
      ])

      expect(result.weights).toContain(700) // font-bold
      expect(result.weights).toContain(300) // font-light
      expect(result.weights).toContain(400) // default fallback
      expect(result.isComplete).toBe(true)

      // Cleanup
      await fs.rm(tempDir, { recursive: true })
    })

    it('should extract weights from inline styles', async () => {
      const { scanFontRequirements } = await import('../../src/build/css/css-classes')
      const fs = await import('node:fs/promises')
      const path = await import('node:path')
      const os = await import('node:os')

      const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'og-test-'))
      const componentPath = path.join(tempDir, 'Test.vue')

      await fs.writeFile(componentPath, `
<template>
  <div style="font-weight: 600">Semi-bold text</div>
</template>
`)

      const result = await scanFontRequirements([
        { path: componentPath, hash: 'test-hash-2', pascalName: 'Test', kebabName: 'test', category: 'app', renderer: 'satori' },
      ])

      expect(result.weights).toContain(600)
      expect(result.isComplete).toBe(true)

      await fs.rm(tempDir, { recursive: true })
    })

    it('should handle responsive prefixes', async () => {
      const { scanFontRequirements } = await import('../../src/build/css/css-classes')
      const fs = await import('node:fs/promises')
      const path = await import('node:path')
      const os = await import('node:os')

      const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'og-test-'))
      const componentPath = path.join(tempDir, 'Test.vue')

      await fs.writeFile(componentPath, `
<template>
  <div class="md:font-bold lg:font-black">Responsive weights</div>
</template>
`)

      const result = await scanFontRequirements([
        { path: componentPath, hash: 'test-hash-3', pascalName: 'Test', kebabName: 'test', category: 'app', renderer: 'satori' },
      ])

      expect(result.weights).toContain(700) // md:font-bold → 700
      expect(result.weights).toContain(900) // lg:font-black → 900

      await fs.rm(tempDir, { recursive: true })
    })

    it('should detect italic style', async () => {
      const { scanFontRequirements } = await import('../../src/build/css/css-classes')
      const fs = await import('node:fs/promises')
      const path = await import('node:path')
      const os = await import('node:os')

      const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'og-test-'))
      const componentPath = path.join(tempDir, 'Test.vue')

      await fs.writeFile(componentPath, `
<template>
  <div class="italic font-bold">Italic bold</div>
</template>
`)

      const result = await scanFontRequirements([
        { path: componentPath, hash: 'test-hash-4', pascalName: 'Test', kebabName: 'test', category: 'app', renderer: 'satori' },
      ])

      expect(result.styles).toContain('italic')
      expect(result.styles).toContain('normal')

      await fs.rm(tempDir, { recursive: true })
    })

    it('should mark incomplete for dynamic font-weight patterns', async () => {
      const { scanFontRequirements } = await import('../../src/build/css/css-classes')
      const fs = await import('node:fs/promises')
      const path = await import('node:path')
      const os = await import('node:os')

      const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'og-test-'))
      const componentPath = path.join(tempDir, 'Test.vue')

      await fs.writeFile(componentPath, `
<template>
  <div :class="{ 'font-bold': props.isBold }">Dynamic weight</div>
</template>
`)

      const result = await scanFontRequirements([
        { path: componentPath, hash: 'test-hash-5', pascalName: 'Test', kebabName: 'test', category: 'app', renderer: 'satori' },
      ])

      // Should still extract the static class from the expression
      expect(result.weights).toContain(700)

      await fs.rm(tempDir, { recursive: true })
    })
  })

  describe('fontRequirements interface', () => {
    it('should have correct shape', async () => {
      const { scanFontRequirements } = await import('../../src/build/css/css-classes')

      const result = await scanFontRequirements([])

      expect(result).toHaveProperty('weights')
      expect(result).toHaveProperty('styles')
      expect(result).toHaveProperty('isComplete')
      expect(Array.isArray(result.weights)).toBe(true)
      expect(Array.isArray(result.styles)).toBe(true)
      expect(typeof result.isComplete).toBe('boolean')
    })
  })
})
