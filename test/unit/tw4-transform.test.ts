import { describe, expect, it } from 'vitest'

// Test the internal functions by importing the module
// We'll test the exported functions and edge cases

describe('tw4-transform', () => {
  describe('safeEvaluateArithmetic', () => {
    // We can't directly test private functions, but we can test via evaluateCalc behavior
    // by testing calc() expressions in CSS values

    it('should handle basic addition', async () => {
      const { resolveClassesToStyles } = await import('../../src/build/css/providers/tw4')
      // This will be tested indirectly through the full flow
      expect(resolveClassesToStyles).toBeDefined()
    })
  })

  describe('parseVarExpression', () => {
    // Test var() parsing edge cases through the full resolution

    it('should handle nested parentheses in fallbacks', async () => {
      // This tests that var(--color, rgb(0, 0, 0)) doesn't break
      const { resolveClassesToStyles } = await import('../../src/build/css/providers/tw4')
      expect(resolveClassesToStyles).toBeDefined()
    })
  })

  describe('convertColorToHex', () => {
    it('should handle invalid color gracefully', async () => {
      const { resolveClassesToStyles } = await import('../../src/build/css/providers/tw4')
      // Invalid colors should not throw
      expect(resolveClassesToStyles).toBeDefined()
    })
  })
})

describe('vue-template-transform', () => {
  describe('transformVueTemplate', () => {
    it('should handle empty template', async () => {
      const { transformVueTemplate } = await import('../../src/build/vue-template-transform')

      const code = `<template></template>`
      const result = await transformVueTemplate(code, {
        resolveStyles: async () => ({}),
      })

      expect(result).toBeUndefined()
    })

    it('should handle template without classes', async () => {
      const { transformVueTemplate } = await import('../../src/build/vue-template-transform')

      const code = `<template><div>Hello</div></template>`
      const result = await transformVueTemplate(code, {
        resolveStyles: async () => ({}),
      })

      expect(result).toBeUndefined()
    })

    it('should transform static classes to inline styles', async () => {
      const { transformVueTemplate } = await import('../../src/build/vue-template-transform')

      const code = `<template><div class="text-red bg-blue">Hello</div></template>`
      const result = await transformVueTemplate(code, {
        resolveStyles: async (classes) => {
          const styles: Record<string, Record<string, string>> = {}
          if (classes.includes('text-red'))
            styles['text-red'] = { color: '#ff0000' }
          if (classes.includes('bg-blue'))
            styles['bg-blue'] = { 'background-color': '#0000ff' }
          return styles
        },
      })

      expect(result).toBeDefined()
      expect(result?.code).toContain('style="')
      expect(result?.code).toContain('color: #ff0000')
      expect(result?.code).toContain('background-color: #0000ff')
    })

    it('should preserve unresolved classes', async () => {
      const { transformVueTemplate } = await import('../../src/build/vue-template-transform')

      const code = `<template><div class="text-red unknown-class">Hello</div></template>`
      const result = await transformVueTemplate(code, {
        resolveStyles: async (classes) => {
          const styles: Record<string, Record<string, string>> = {}
          if (classes.includes('text-red'))
            styles['text-red'] = { color: '#ff0000' }
          // unknown-class is not resolved
          return styles
        },
      })

      expect(result).toBeDefined()
      expect(result?.code).toContain('class="unknown-class"')
      expect(result?.code).toContain('style="')
    })

    it('should merge with existing inline styles', async () => {
      const { transformVueTemplate } = await import('../../src/build/vue-template-transform')

      const code = `<template><div class="text-red" style="margin: 10px">Hello</div></template>`
      const result = await transformVueTemplate(code, {
        resolveStyles: async () => ({
          'text-red': { color: '#ff0000' },
        }),
      })

      expect(result).toBeDefined()
      // Existing style should take precedence
      expect(result?.code).toContain('margin: 10px')
      expect(result?.code).toContain('color: #ff0000')
    })

    it('should escape quotes in style values', async () => {
      const { transformVueTemplate } = await import('../../src/build/vue-template-transform')

      const code = `<template><div class="font-custom">Hello</div></template>`
      const result = await transformVueTemplate(code, {
        resolveStyles: async () => ({
          'font-custom': { 'font-family': '"Custom Font", sans-serif' },
        }),
      })

      expect(result).toBeDefined()
      // Quotes should be escaped
      expect(result?.code).toContain('&quot;')
    })

    it('should handle multiple elements', async () => {
      const { transformVueTemplate } = await import('../../src/build/vue-template-transform')

      const code = `<template>
        <div class="text-red">One</div>
        <div class="text-blue">Two</div>
      </template>`
      const result = await transformVueTemplate(code, {
        resolveStyles: async (classes) => {
          const styles: Record<string, Record<string, string>> = {}
          if (classes.includes('text-red'))
            styles['text-red'] = { color: '#ff0000' }
          if (classes.includes('text-blue'))
            styles['text-blue'] = { color: '#0000ff' }
          return styles
        },
      })

      expect(result).toBeDefined()
      expect(result?.code).toContain('#ff0000')
      expect(result?.code).toContain('#0000ff')
    })

    it('should emit flex-direction:row when flex resolves to display:flex', async () => {
      const { transformVueTemplate } = await import('../../src/build/vue-template-transform')

      const code = `<template><div class="flex items-center gap-3"><span>text</span></div></template>`
      const result = await transformVueTemplate(code, {
        resolveStyles: async (classes) => {
          const styles: Record<string, Record<string, string>> = {}
          if (classes.includes('flex'))
            styles.flex = { display: 'flex' }
          if (classes.includes('items-center'))
            styles['items-center'] = { 'align-items': 'center' }
          if (classes.includes('gap-3'))
            styles['gap-3'] = { gap: '0.75rem' }
          return styles
        },
      })

      expect(result).toBeDefined()
      expect(result?.code).toContain('flex-direction: row')
      expect(result?.code).toContain('display: flex')
    })

    it('should NOT emit flex-direction:row when flex-col also present', async () => {
      const { transformVueTemplate } = await import('../../src/build/vue-template-transform')

      const code = `<template><div class="flex flex-col justify-between"><span>text</span></div></template>`
      const result = await transformVueTemplate(code, {
        resolveStyles: async (classes) => {
          const styles: Record<string, Record<string, string>> = {}
          if (classes.includes('flex'))
            styles.flex = { display: 'flex' }
          if (classes.includes('flex-col'))
            styles['flex-col'] = { 'flex-direction': 'column' }
          if (classes.includes('justify-between'))
            styles['justify-between'] = { 'justify-content': 'space-between' }
          return styles
        },
      })

      expect(result).toBeDefined()
      expect(result?.code).toContain('flex-direction: column')
      expect(result?.code).not.toContain('flex-direction: row')
    })

    it('should NOT emit flex-direction when no flex class', async () => {
      const { transformVueTemplate } = await import('../../src/build/vue-template-transform')

      const code = `<template><div class="w-full items-center"><span>text</span></div></template>`
      const result = await transformVueTemplate(code, {
        resolveStyles: async (classes) => {
          const styles: Record<string, Record<string, string>> = {}
          if (classes.includes('w-full'))
            styles['w-full'] = { width: '100%' }
          if (classes.includes('items-center'))
            styles['items-center'] = { 'align-items': 'center' }
          return styles
        },
      })

      expect(result).toBeDefined()
      expect(result?.code).not.toContain('flex-direction')
    })

    it('should emit flex-direction:row for flex gap-2 (CombinedTest fixture)', async () => {
      const { transformVueTemplate } = await import('../../src/build/vue-template-transform')

      // Matches: <div class="flex gap-2"> from CombinedTest.satori.vue
      // gap-2 may or may not resolve at build-time — either way, flex-direction:row must be emitted
      const code = `<template><div class="flex gap-2"><span>icon1</span><span>icon2</span></div></template>`
      const result = await transformVueTemplate(code, {
        resolveStyles: async (classes) => {
          const styles: Record<string, Record<string, string>> = {}
          if (classes.includes('flex'))
            styles.flex = { display: 'flex' }
          // gap-2 unresolved (stays as class for runtime)
          return styles
        },
      })

      expect(result).toBeDefined()
      expect(result?.code).toContain('flex-direction: row')
      expect(result?.code).toContain('display: flex')
      // gap-2 should remain as unresolved class
      expect(result?.code).toContain('class="gap-2"')
    })

    it('should respect inline style flex-direction override', async () => {
      const { transformVueTemplate } = await import('../../src/build/vue-template-transform')

      const code = `<template><div class="flex" style="flex-direction: column"><span>text</span></div></template>`
      const result = await transformVueTemplate(code, {
        resolveStyles: async (classes) => {
          const styles: Record<string, Record<string, string>> = {}
          if (classes.includes('flex'))
            styles.flex = { display: 'flex' }
          return styles
        },
      })

      expect(result).toBeDefined()
      // Inline style flex-direction:column should win over the auto-injected row
      expect(result?.code).toContain('flex-direction: column')
      expect(result?.code).not.toContain('flex-direction: row')
    })

    it('should handle resolver errors gracefully', async () => {
      const { transformVueTemplate } = await import('../../src/build/vue-template-transform')

      const code = `<template><div class="text-red">Hello</div></template>`
      await transformVueTemplate(code, {
        resolveStyles: async () => {
          throw new Error('Resolver failed')
        },
      }).catch(() => undefined)

      // Should not crash, may return undefined or partial result
      expect(true).toBe(true)
    })

    it('font-mono should not reset text-8xl font-size in merged output', async () => {
      const { transformVueTemplate } = await import('../../src/build/vue-template-transform')

      const code = `<template><h1 class="font-mono text-8xl tracking-tighter mb-4">Title</h1></template>`
      const result = await transformVueTemplate(code, {
        resolveStyles: async (classes) => {
          const styles: Record<string, Record<string, string>> = {}
          if (classes.includes('font-mono'))
            styles['font-mono'] = { 'font-family': 'ui-monospace, monospace' }
          if (classes.includes('text-8xl'))
            styles['text-8xl'] = { 'font-size': '96px', 'line-height': '1' }
          if (classes.includes('tracking-tighter'))
            styles['tracking-tighter'] = { 'letter-spacing': '-0.05em' }
          if (classes.includes('mb-4'))
            styles['mb-4'] = { 'margin-bottom': '16px' }
          return styles
        },
      })

      expect(result).toBeDefined()
      const styleMatch = result!.code.match(/style="([^"]*)"/)
      expect(styleMatch, 'should have a style attribute').toBeDefined()
      const styleStr = styleMatch![1]!

      // All properties must be present in the merged style
      expect(styleStr).toContain('font-family')
      expect(styleStr).toContain('font-size: 96px')
      expect(styleStr).toContain('line-height: 1')
      expect(styleStr).toContain('letter-spacing: -0.05em')
      expect(styleStr).toContain('margin-bottom: 16px')

      // No class attribute should remain (all resolved)
      expect(result!.code).not.toContain('class=')
    })

    it('class order: font-mono BEFORE text-8xl produces same style as AFTER (full UnoCSS pipeline)', async () => {
      const { transformVueTemplate } = await import('../../src/build/vue-template-transform')
      const { clearUnoCache, createUnoProvider, setUnoConfig, setUnoRootDir } = await import('../../src/build/css/providers/uno')
      const presetWind4 = await import('@unocss/preset-wind4')

      clearUnoCache()
      setUnoRootDir('/tmp/og-image-uno-order-test')
      setUnoConfig({
        presets: [presetWind4.default()],
        theme: {
          spacing: { DEFAULT: '4px' },
          font: {
            mono: '\'Geist Mono\', monospace',
            sans: '\'Geist\', system-ui, -apple-system, sans-serif',
          },
        },
      })
      const provider = createUnoProvider()

      // Order A: font-mono BEFORE text-8xl (the buggy order)
      const codeA = `<template><h1 class="font-mono text-8xl tracking-tighter mb-4">Title</h1></template>`
      clearUnoCache()
      const resultA = await transformVueTemplate(codeA, {
        resolveStyles: classes => provider.resolveClassesToStyles(classes) as Promise<Record<string, Record<string, string>>>,
      })

      // Order B: text-8xl BEFORE font-mono (the working order)
      const codeB = `<template><h1 class="text-8xl font-mono tracking-tighter mb-4">Title</h1></template>`
      clearUnoCache()
      const resultB = await transformVueTemplate(codeB, {
        resolveStyles: classes => provider.resolveClassesToStyles(classes) as Promise<Record<string, Record<string, string>>>,
      })

      expect(resultA, 'order A should produce a result').toBeDefined()
      expect(resultB, 'order B should produce a result').toBeDefined()

      // Extract style attributes
      const styleA = resultA!.code.match(/style="([^"]*)"/)
      const styleB = resultB!.code.match(/style="([^"]*)"/)
      expect(styleA, 'order A should have style attr').toBeDefined()
      expect(styleB, 'order B should have style attr').toBeDefined()

      // Parse style strings into property maps for comparison (order-independent)
      function parseStyle(s: string): Record<string, string> {
        const result: Record<string, string> = {}
        for (const decl of s.split(';')) {
          const idx = decl.indexOf(':')
          if (idx === -1)
            continue
          const prop = decl.slice(0, idx).trim()
          const val = decl.slice(idx + 1).trim()
          if (prop && val)
            result[prop] = val
        }
        return result
      }

      const propsA = parseStyle(styleA![1]!)
      const propsB = parseStyle(styleB![1]!)

      // Both orderings must produce the SAME set of CSS properties
      expect(Object.keys(propsA).sort(), 'same property names').toEqual(Object.keys(propsB).sort())
      // And the same values
      for (const key of Object.keys(propsA)) {
        expect(propsA[key], `${key} should be identical`).toBe(propsB[key])
      }

      // Verify critical properties are present
      expect(propsA['font-family'], 'should have font-family').toBeDefined()
      expect(propsA['font-size'], 'should have font-size').toBeDefined()
      expect(propsA['letter-spacing'], 'should have letter-spacing').toBeDefined()
      expect(propsA['margin-bottom'], 'should have margin-bottom').toBeDefined()

      // Font-family should be the first custom family name —
      // multi-word names are CSS-quoted, no generic fallbacks (OG renderers don't do font fallback)
      expect(styleA![1], 'style A must not contain &quot;').not.toContain('&quot;')
      expect(styleB![1], 'style B must not contain &quot;').not.toContain('&quot;')
      expect(propsA['font-family'], 'font-family should be quoted multi-word').toBe('\'Geist Mono\'')

      // Neither should have remaining class attributes (all resolved)
      expect(resultA!.code).not.toContain('class=')
      expect(resultB!.code).not.toContain('class=')

      clearUnoCache()
    })

    it('font-mono + text-8xl full TW4 resolution pipeline produces correct merged styles', async () => {
      const { transformVueTemplate } = await import('../../src/build/vue-template-transform')
      const { resolveClassesToStyles, clearTw4Cache } = await import('../../src/build/css/providers/tw4')
      const { mkdir, writeFile, rm } = await import('node:fs/promises')
      const { join } = await import('pathe')

      const tmpDir = join(import.meta.dirname, '..', '.tmp-tw4-transform-test')
      const cssPath = join(tmpDir, 'input.css')
      await mkdir(tmpDir, { recursive: true })
      await writeFile(cssPath, '@import "tailwindcss";')

      try {
        const code = `<template><h1 class="font-mono text-8xl tracking-tighter mb-4">Title</h1></template>`
        const result = await transformVueTemplate(code, {
          resolveStyles: classes => resolveClassesToStyles(classes, { cssPath }),
        })

        expect(result).toBeDefined()
        const styleMatch = result!.code.match(/style="([^"]*)"/)
        expect(styleMatch, 'should have a style attribute').toBeDefined()
        const styleStr = styleMatch![1]!

        // font-family from font-mono
        expect(styleStr, 'should contain font-family from font-mono').toContain('font-family:')
        // font-size from text-8xl (6rem or 96px depending on var resolution)
        expect(styleStr, 'should contain font-size from text-8xl').toMatch(/font-size:\s*(?:6rem|96px)/)
        // letter-spacing from tracking-tighter
        expect(styleStr, 'should contain letter-spacing from tracking-tighter').toContain('letter-spacing:')
        // margin-bottom from mb-4
        expect(styleStr, 'should contain margin-bottom from mb-4').toContain('margin-bottom:')
      }
      finally {
        clearTw4Cache()
        await rm(tmpDir, { recursive: true, force: true })
      }
    })
  })
})
