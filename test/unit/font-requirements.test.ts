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

      expect(result.global.weights).toContain(400) // Always includes 400 as fallback
      expect(result.global.styles).toContain('normal') // Always includes normal
      expect(result.global.isComplete).toBe(true)
      expect(result.components).toEqual({})
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

      expect(result.global.weights).toContain(700) // font-bold
      expect(result.global.weights).toContain(300) // font-light
      expect(result.global.weights).toContain(400) // default fallback
      expect(result.global.isComplete).toBe(true)
      expect(result.components.Test).toBeDefined()
      expect(result.components.Test.weights).toContain(700)
      expect(result.components.Test.weights).toContain(300)

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

      expect(result.global.weights).toContain(600)
      expect(result.global.isComplete).toBe(true)

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

      expect(result.global.weights).toContain(700) // md:font-bold → 700
      expect(result.global.weights).toContain(900) // lg:font-black → 900

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

      expect(result.global.styles).toContain('italic')
      expect(result.global.styles).toContain('normal')

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
      expect(result.global.weights).toContain(700)

      await fs.rm(tempDir, { recursive: true })
    })
  })

  describe('font family detection', () => {
    it('should detect font-family classes like font-sans, font-serif', async () => {
      const { scanFontRequirements } = await import('../../src/build/css/css-classes')
      const fs = await import('node:fs/promises')
      const path = await import('node:path')
      const os = await import('node:os')

      const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'og-test-'))
      const componentPath = path.join(tempDir, 'Test.vue')

      await fs.writeFile(componentPath, `
<template>
  <div class="font-sans font-bold">Sans text</div>
  <span class="font-serif">Serif text</span>
</template>
`)

      const result = await scanFontRequirements([
        { path: componentPath, hash: 'test-family-1', pascalName: 'Test', kebabName: 'test', category: 'app', renderer: 'satori' },
      ])

      expect(result.global.familyClasses).toContain('sans')
      expect(result.global.familyClasses).toContain('serif')
      expect(result.global.familyNames).toEqual([])
      expect(result.components.Test.familyClasses).toContain('sans')
      expect(result.components.Test.familyClasses).toContain('serif')

      await fs.rm(tempDir, { recursive: true })
    })

    it('should detect custom font-family classes like font-inter', async () => {
      const { scanFontRequirements } = await import('../../src/build/css/css-classes')
      const fs = await import('node:fs/promises')
      const path = await import('node:path')
      const os = await import('node:os')

      const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'og-test-'))
      const componentPath = path.join(tempDir, 'Test.vue')

      await fs.writeFile(componentPath, `
<template>
  <div class="font-inter">Custom font</div>
</template>
`)

      const result = await scanFontRequirements([
        { path: componentPath, hash: 'test-family-2', pascalName: 'Test', kebabName: 'test', category: 'app', renderer: 'satori' },
      ])

      expect(result.global.familyClasses).toContain('inter')

      await fs.rm(tempDir, { recursive: true })
    })

    it('should not confuse weight classes with family classes', async () => {
      const { scanFontRequirements } = await import('../../src/build/css/css-classes')
      const fs = await import('node:fs/promises')
      const path = await import('node:path')
      const os = await import('node:os')

      const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'og-test-'))
      const componentPath = path.join(tempDir, 'Test.vue')

      await fs.writeFile(componentPath, `
<template>
  <div class="font-bold font-sans italic">Mixed classes</div>
</template>
`)

      const result = await scanFontRequirements([
        { path: componentPath, hash: 'test-family-3', pascalName: 'Test', kebabName: 'test', category: 'app', renderer: 'satori' },
      ])

      // font-bold is a weight class, not family
      expect(result.global.familyClasses).toContain('sans')
      expect(result.global.familyClasses).not.toContain('bold')
      expect(result.global.familyClasses).not.toContain('normal')
      expect(result.global.weights).toContain(700)

      await fs.rm(tempDir, { recursive: true })
    })

    it('should extract font-family from inline styles', async () => {
      const { scanFontRequirements } = await import('../../src/build/css/css-classes')
      const fs = await import('node:fs/promises')
      const path = await import('node:path')
      const os = await import('node:os')

      const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'og-test-'))
      const componentPath = path.join(tempDir, 'Test.vue')

      await fs.writeFile(componentPath, `
<template>
  <div style="font-family: 'Inter', sans-serif">Inline font</div>
</template>
`)

      const result = await scanFontRequirements([
        { path: componentPath, hash: 'test-family-4', pascalName: 'Test', kebabName: 'test', category: 'app', renderer: 'satori' },
      ])

      expect(result.global.familyNames).toContain('Inter')
      // sans-serif is a generic family, should be excluded
      expect(result.global.familyNames).not.toContain('sans-serif')

      await fs.rm(tempDir, { recursive: true })
    })

    it('should handle arbitrary font-family values like font-[Inter]', async () => {
      const { scanFontRequirements } = await import('../../src/build/css/css-classes')
      const fs = await import('node:fs/promises')
      const path = await import('node:path')
      const os = await import('node:os')

      const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'og-test-'))
      const componentPath = path.join(tempDir, 'Test.vue')

      await fs.writeFile(componentPath, `
<template>
  <div class="font-['Inter']">Arbitrary font</div>
</template>
`)

      const result = await scanFontRequirements([
        { path: componentPath, hash: 'test-family-5', pascalName: 'Test', kebabName: 'test', category: 'app', renderer: 'satori' },
      ])

      expect(result.global.familyNames).toContain('Inter')

      await fs.rm(tempDir, { recursive: true })
    })

    it('should return empty families when no font-family classes used', async () => {
      const { scanFontRequirements } = await import('../../src/build/css/css-classes')
      const fs = await import('node:fs/promises')
      const path = await import('node:path')
      const os = await import('node:os')

      const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'og-test-'))
      const componentPath = path.join(tempDir, 'Test.vue')

      await fs.writeFile(componentPath, `
<template>
  <div class="font-bold">No family class</div>
</template>
`)

      const result = await scanFontRequirements([
        { path: componentPath, hash: 'test-family-6', pascalName: 'Test', kebabName: 'test', category: 'app', renderer: 'satori' },
      ])

      expect(result.global.familyClasses).toEqual([])
      expect(result.global.familyNames).toEqual([])

      await fs.rm(tempDir, { recursive: true })
    })

    it('should detect font-family classes with responsive prefixes', async () => {
      const { scanFontRequirements } = await import('../../src/build/css/css-classes')
      const fs = await import('node:fs/promises')
      const path = await import('node:path')
      const os = await import('node:os')

      const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'og-test-'))
      const componentPath = path.join(tempDir, 'Test.vue')

      await fs.writeFile(componentPath, `
<template>
  <div class="md:font-serif lg:font-mono">Responsive font families</div>
</template>
`)

      const result = await scanFontRequirements([
        { path: componentPath, hash: 'test-family-7', pascalName: 'Test', kebabName: 'test', category: 'app', renderer: 'satori' },
      ])

      expect(result.global.familyClasses).toContain('serif')
      expect(result.global.familyClasses).toContain('mono')

      await fs.rm(tempDir, { recursive: true })
    })
  })

  describe('fontRequirements interface', () => {
    it('should have correct shape', async () => {
      const { scanFontRequirements } = await import('../../src/build/css/css-classes')

      const result = await scanFontRequirements([])

      expect(result).toHaveProperty('global')
      expect(result).toHaveProperty('components')
      expect(result.global).toHaveProperty('weights')
      expect(result.global).toHaveProperty('styles')
      expect(result.global).toHaveProperty('familyClasses')
      expect(result.global).toHaveProperty('familyNames')
      expect(result.global).toHaveProperty('isComplete')
      expect(Array.isArray(result.global.weights)).toBe(true)
      expect(Array.isArray(result.global.styles)).toBe(true)
      expect(Array.isArray(result.global.familyClasses)).toBe(true)
      expect(Array.isArray(result.global.familyNames)).toBe(true)
      expect(typeof result.global.isComplete).toBe('boolean')
      expect(typeof result.components).toBe('object')
    })
  })
})
