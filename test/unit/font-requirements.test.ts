import { describe, expect, it } from 'vitest'

describe('font-requirements', () => {
  describe('module exports', () => {
    it('should be exported', async () => {
      const { extractFontRequirementsFromVue } = await import('../../src/build/css/css-classes')
      expect(extractFontRequirementsFromVue).toBeDefined()
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

  describe('extractFontRequirementsFromVue', () => {
    it('should return default requirements for empty template', async () => {
      const { extractFontRequirementsFromVue } = await import('../../src/build/css/css-classes')

      const result = await extractFontRequirementsFromVue('<template><div></div></template>')

      expect(result.weights.size).toBe(0)
      expect(result.styles).toContain('normal')
      expect(result.hasDynamicBindings).toBe(false)
    })

    it('should extract weights from vue component with font classes', async () => {
      const { extractFontRequirementsFromVue } = await import('../../src/build/css/css-classes')

      const result = await extractFontRequirementsFromVue(`
<template>
  <div class="font-bold">Bold text</div>
  <span class="font-light">Light text</span>
</template>
`)

      expect(result.weights).toContain(700) // font-bold
      expect(result.weights).toContain(300) // font-light
      expect(result.hasDynamicBindings).toBe(false)
    })

    it('should extract weights from inline styles', async () => {
      const { extractFontRequirementsFromVue } = await import('../../src/build/css/css-classes')

      const result = await extractFontRequirementsFromVue(`
<template>
  <div style="font-weight: 600">Semi-bold text</div>
</template>
`)

      expect(result.weights).toContain(600)
      expect(result.hasDynamicBindings).toBe(false)
    })

    it('should handle responsive prefixes', async () => {
      const { extractFontRequirementsFromVue } = await import('../../src/build/css/css-classes')

      const result = await extractFontRequirementsFromVue(`
<template>
  <div class="md:font-bold lg:font-black">Responsive weights</div>
</template>
`)

      expect(result.weights).toContain(700) // md:font-bold → 700
      expect(result.weights).toContain(900) // lg:font-black → 900
    })

    it('should detect italic style', async () => {
      const { extractFontRequirementsFromVue } = await import('../../src/build/css/css-classes')

      const result = await extractFontRequirementsFromVue(`
<template>
  <div class="italic font-bold">Italic bold</div>
</template>
`)

      expect(result.styles).toContain('italic')
      expect(result.styles).toContain('normal')
    })

    it('should detect dynamic font bindings', async () => {
      const { extractFontRequirementsFromVue } = await import('../../src/build/css/css-classes')

      const result = await extractFontRequirementsFromVue(`
<template>
  <div :class="{ 'font-bold': props.isBold }">Dynamic weight</div>
</template>
`)

      // Should still extract the static class from the expression
      expect(result.weights).toContain(700)
    })
  })

  describe('font family detection', () => {
    it('should detect font-family classes like font-sans, font-serif', async () => {
      const { extractFontRequirementsFromVue } = await import('../../src/build/css/css-classes')

      const result = await extractFontRequirementsFromVue(`
<template>
  <div class="font-sans font-bold">Sans text</div>
  <span class="font-serif">Serif text</span>
</template>
`)

      expect(result.familyClasses).toContain('sans')
      expect(result.familyClasses).toContain('serif')
      expect(result.familyNames.size).toBe(0)
    })

    it('should detect custom font-family classes like font-inter', async () => {
      const { extractFontRequirementsFromVue } = await import('../../src/build/css/css-classes')

      const result = await extractFontRequirementsFromVue(`
<template>
  <div class="font-inter">Custom font</div>
</template>
`)

      expect(result.familyClasses).toContain('inter')
    })

    it('should not confuse weight classes with family classes', async () => {
      const { extractFontRequirementsFromVue } = await import('../../src/build/css/css-classes')

      const result = await extractFontRequirementsFromVue(`
<template>
  <div class="font-bold font-sans italic">Mixed classes</div>
</template>
`)

      // font-bold is a weight class, not family
      expect(result.familyClasses).toContain('sans')
      expect(result.familyClasses).not.toContain('bold')
      expect(result.familyClasses).not.toContain('normal')
      expect(result.weights).toContain(700)
    })

    it('should extract font-family from inline styles', async () => {
      const { extractFontRequirementsFromVue } = await import('../../src/build/css/css-classes')

      const result = await extractFontRequirementsFromVue(`
<template>
  <div style="font-family: 'Inter', sans-serif">Inline font</div>
</template>
`)

      expect(result.familyNames).toContain('Inter')
      // sans-serif is a generic family, should be excluded
      expect(result.familyNames).not.toContain('sans-serif')
    })

    it('should handle arbitrary font-family values like font-[Inter]', async () => {
      const { extractFontRequirementsFromVue } = await import('../../src/build/css/css-classes')

      const result = await extractFontRequirementsFromVue(`
<template>
  <div class="font-['Inter']">Arbitrary font</div>
</template>
`)

      expect(result.familyNames).toContain('Inter')
    })

    it('should return empty families when no font-family classes used', async () => {
      const { extractFontRequirementsFromVue } = await import('../../src/build/css/css-classes')

      const result = await extractFontRequirementsFromVue(`
<template>
  <div class="font-bold">No family class</div>
</template>
`)

      expect(result.familyClasses.size).toBe(0)
      expect(result.familyNames.size).toBe(0)
    })

    it('should detect font-family classes with responsive prefixes', async () => {
      const { extractFontRequirementsFromVue } = await import('../../src/build/css/css-classes')

      const result = await extractFontRequirementsFromVue(`
<template>
  <div class="md:font-serif lg:font-mono">Responsive font families</div>
</template>
`)

      expect(result.familyClasses).toContain('serif')
      expect(result.familyClasses).toContain('mono')
    })
  })

  describe('extractFontRequirementsFromVue return shape', () => {
    it('should have correct shape', async () => {
      const { extractFontRequirementsFromVue } = await import('../../src/build/css/css-classes')

      const result = await extractFontRequirementsFromVue('<template><div></div></template>')

      expect(result).toHaveProperty('weights')
      expect(result).toHaveProperty('styles')
      expect(result).toHaveProperty('familyClasses')
      expect(result).toHaveProperty('familyNames')
      expect(result).toHaveProperty('hasDynamicBindings')
      expect(result.weights).toBeInstanceOf(Set)
      expect(result.styles).toBeInstanceOf(Set)
      expect(result.familyClasses).toBeInstanceOf(Set)
      expect(result.familyNames).toBeInstanceOf(Set)
      expect(typeof result.hasDynamicBindings).toBe('boolean')
    })
  })
})
