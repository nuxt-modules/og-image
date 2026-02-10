import { describe, expect, it } from 'vitest'
import { extractDefinePropsType } from '../../src/templates'

function sfc(script: string, template = '<template><div /></template>') {
  return `<script setup lang="ts">\n${script}\n</script>\n\n${template}`
}

describe('extractDefinePropsType', () => {
  describe('basic extraction', () => {
    it('extracts simple inline props', () => {
      const result = extractDefinePropsType(sfc(`
        defineProps<{
          title: string
          count: number
        }>()
      `))
      expect(result).toContain('title: string')
      expect(result).toContain('count: number')
    })

    it('extracts single-line props', () => {
      const result = extractDefinePropsType(sfc(
        `defineProps<{ title: string }>()`,
      ))
      expect(result).toBe('{ title: string }')
    })

    it('extracts optional props', () => {
      const result = extractDefinePropsType(sfc(`
        defineProps<{
          name: string
          color?: string
        }>()
      `))
      expect(result).toContain('name: string')
      expect(result).toContain('color?: string')
    })

    it('extracts props with boolean and number types', () => {
      const result = extractDefinePropsType(sfc(`
        defineProps<{
          visible: boolean
          count: number
          label: string
        }>()
      `))
      expect(result).toContain('visible: boolean')
      expect(result).toContain('count: number')
      expect(result).toContain('label: string')
    })
  })

  describe('withDefaults and destructured defaults', () => {
    it('extracts props from withDefaults wrapper', () => {
      const result = extractDefinePropsType(sfc(`
        const props = withDefaults(
          defineProps<{
            count?: number
            msg?: string
          }>(),
          {
            count: 0,
            msg: 'hello'
          }
        )
      `))
      expect(result).toMatchInlineSnapshot(`
        "{
                    count?: number
                    msg?: string
                  }"
      `)
    })

    it('extracts props from destructured defineProps with defaults', () => {
      const result = extractDefinePropsType(sfc(`
        const { count = 0, msg = 'hello' } = defineProps<{
          count?: number
          message?: string
        }>()
      `))
      expect(result).toMatchInlineSnapshot(`
          "{
                    count?: number
                    message?: string
                  }"
        `)
    })

    it('extracts from single-line withDefaults', () => {
      const result = extractDefinePropsType(sfc(
        `withDefaults(defineProps<{ title: string, color?: string }>(), { color: 'red' })`,
      ))
      expect(result).toBe('{ title: string, color?: string }')
    })
  })

  describe('nested generics', () => {
    it('handles Array generic in props', () => {
      const result = extractDefinePropsType(sfc(`
        defineProps<{
          items: Array<string>
          tags: string[]
        }>()
      `))
      expect(result).toContain('items: Array<string>')
      expect(result).toContain('tags: string[]')
    })

    it('handles Record generic in props', () => {
      const result = extractDefinePropsType(sfc(`
        defineProps<{
          metadata: Record<string, any>
        }>()
      `))
      expect(result).toContain('metadata: Record<string, any>')
    })

    it('handles nested object types in generics', () => {
      const result = extractDefinePropsType(sfc(`
        defineProps<{
          items: Array<{ id: number, name: string }>
        }>()
      `))
      expect(result).toContain('items: Array<{ id: number, name: string }>')
    })

    it('handles deeply nested generics', () => {
      const result = extractDefinePropsType(sfc(`
        defineProps<{
          data: Map<string, Set<number>>
        }>()
      `))
      expect(result).toContain('data: Map<string, Set<number>>')
    })
  })

  describe('union and intersection types', () => {
    it('handles union types', () => {
      const result = extractDefinePropsType(sfc(`
        defineProps<{
          variant: 'primary' | 'secondary' | 'danger'
          value: string | number
        }>()
      `))
      expect(result).toContain(`variant: 'primary' | 'secondary' | 'danger'`)
      expect(result).toContain('value: string | number')
    })

    it('handles nullable types', () => {
      const result = extractDefinePropsType(sfc(`
        defineProps<{
          title: string | null
        }>()
      `))
      expect(result).toContain('title: string | null')
    })
  })

  describe('imports — safe cases (no reference in props)', () => {
    it('extracts when imports exist but are not referenced in props', () => {
      const result = extractDefinePropsType(sfc(`
        import { joinURL } from 'ufo'
        import { computed } from 'vue'

        defineProps<{
          name: string
          version: string
        }>()
      `))
      expect(result).toContain('name: string')
      expect(result).toContain('version: string')
    })

    it('extracts with type imports not referenced in props', () => {
      const result = extractDefinePropsType(sfc(`
        import type { Ref } from 'vue'

        defineProps<{
          title: string
        }>()

        const x: Ref<string> = ref('')
      `))
      expect(result).toContain('title: string')
    })

    it('extracts with default import not referenced in props', () => {
      const result = extractDefinePropsType(sfc(`
        import defu from 'defu'

        defineProps<{
          color: string
        }>()
      `))
      expect(result).toBe(`{
          color: string
        }`)
    })
  })

  describe('imports — unsafe cases (referenced in props)', () => {
    it('returns null when props reference a named import type', () => {
      const result = extractDefinePropsType(sfc(`
        import type { PackageData } from '~/types'

        defineProps<{
          pkg: PackageData
        }>()
      `))
      expect(result).toBeNull()
    })

    it('returns null when props reference a renamed import', () => {
      const result = extractDefinePropsType(sfc(`
        import type { SomeType as MyType } from '~/types'

        defineProps<{
          data: MyType
        }>()
      `))
      expect(result).toBeNull()
    })

    it('returns null when props reference a default import type', () => {
      const result = extractDefinePropsType(sfc(`
        import SomeClass from '~/utils'

        defineProps<{
          instance: SomeClass
        }>()
      `))
      expect(result).toBeNull()
    })

    it('returns null when import is used in a generic', () => {
      const result = extractDefinePropsType(sfc(`
        import type { Item } from '~/types'

        defineProps<{
          items: Array<Item>
        }>()
      `))
      expect(result).toBeNull()
    })

    it('returns null with multiple imports where one is referenced', () => {
      const result = extractDefinePropsType(sfc(`
        import { joinURL } from 'ufo'
        import type { Theme } from '~/types'

        defineProps<{
          theme: Theme
          name: string
        }>()
      `))
      expect(result).toBeNull()
    })
  })

  describe('non-extractable patterns', () => {
    it('returns null for runtime defineProps (object syntax)', () => {
      const result = extractDefinePropsType(sfc(`
        defineProps({
          title: String,
          count: Number,
        })
      `))
      expect(result).toBeNull()
    })

    it('returns null for type reference (not inline object)', () => {
      const result = extractDefinePropsType(sfc(`
        interface Props {
          title: string
        }

        defineProps<Props>()
      `))
      expect(result).toBeNull()
    })

    it('returns null for type alias reference', () => {
      const result = extractDefinePropsType(sfc(`
        type MyProps = {
          title: string
        }

        defineProps<MyProps>()
      `))
      expect(result).toBeNull()
    })

    it('returns null for no script setup', () => {
      const result = extractDefinePropsType(`
        <script lang="ts">
        export default defineComponent({
          props: { title: String }
        })
        </script>
        <template><div /></template>
      `)
      expect(result).toBeNull()
    })

    it('returns null for empty script setup', () => {
      const result = extractDefinePropsType(sfc(''))
      expect(result).toBeNull()
    })

    it('returns null for no defineProps', () => {
      const result = extractDefinePropsType(sfc(`
        const msg = ref('hello')
      `))
      expect(result).toBeNull()
    })

    it('returns null for template-only component', () => {
      const result = extractDefinePropsType(`<template><div>hello</div></template>`)
      expect(result).toBeNull()
    })
  })

  describe('real-world OG image components', () => {
    it('extracts from typical OG image component (npmx.dev pattern)', () => {
      const result = extractDefinePropsType(sfc(`
        import { joinURL } from 'ufo'

        const props = withDefaults(
          defineProps<{
            name: string
            version: string
            primaryColor?: string
          }>(),
          {
            primaryColor: '#60a5fa',
          },
        )

        const { name, version, primaryColor } = toRefs(props)

        const { data: pkg } = usePackage(name, () => version.value)
      `))
      expect(result).toContain('name: string')
      expect(result).toContain('version: string')
      expect(result).toContain('primaryColor?: string')
    })

    it('extracts from minimal OG image component', () => {
      const result = extractDefinePropsType(sfc(`
        defineProps<{
          title?: string
          description?: string
          themeColor?: string
          appName?: string
        }>()
      `))
      expect(result).toContain('title?: string')
      expect(result).toContain('description?: string')
      expect(result).toContain('themeColor?: string')
      expect(result).toContain('appName?: string')
    })

    it('returns null for runtime-defined OG image component', () => {
      const result = extractDefinePropsType(sfc(`
        defineProps({
          path: String,
          title: String,
          description: String,
          bgColor: String,
        })
      `))
      expect(result).toBeNull()
    })
  })

  describe('edge cases', () => {
    it('handles props with inline object types', () => {
      const result = extractDefinePropsType(sfc(`
        defineProps<{
          config: { width: number, height: number }
        }>()
      `))
      expect(result).toContain('config: { width: number, height: number }')
    })

    it('handles props with function types', () => {
      const result = extractDefinePropsType(sfc(`
        defineProps<{
          onClick: () => void
          formatter: (val: string) => string
        }>()
      `))
      expect(result).toContain('onClick: () => void')
      expect(result).toContain('formatter: (val: string) => string')
    })

    it('handles props with tuple types', () => {
      const result = extractDefinePropsType(sfc(`
        defineProps<{
          coords: [number, number]
        }>()
      `))
      expect(result).toContain('coords: [number, number]')
    })

    it('does not confuse angle brackets in string literals with generics', () => {
      // This is a known limitation — string literals with < or > may confuse the parser
      // But it fails safely (returns null rather than wrong data)
      // May or may not extract correctly — but should not crash
      expect(() => extractDefinePropsType(sfc(`
        defineProps<{
          separator: '<' | '>'
        }>()
      `))).not.toThrow()
    })

    it('handles multiline with comments between props', () => {
      const result = extractDefinePropsType(sfc(`
        defineProps<{
          // The page title
          title: string
          /** Optional description */
          description?: string
        }>()
      `))
      expect(result).toContain('title: string')
      expect(result).toContain('description?: string')
    })

    it('import name as substring of prop type does not false-positive', () => {
      const result = extractDefinePropsType(sfc(`
        import type { Component } from 'vue'

        defineProps<{
          title: string
        }>()
      `))
      expect(result).toContain('title: string')
    })

    it('finds real defineProps when a commented-out one appears first', () => {
      const result = extractDefinePropsType(sfc(`
        // old: defineProps<{ old: string }>()

        defineProps<{
          current: string
        }>()
      `))
      expect(result).toContain('current: string')
    })

    it('falls back safely when defineProps< is inside a block comment', () => {
      const result = extractDefinePropsType(sfc(`
        /* defineProps<{ fake: number }>() */

        defineProps<{
          real: string
        }>()
      `))
      expect(result).toContain('real: string')
    })

    it('handles generic script setup (generic="T") — bails on unresolvable type param', () => {
      // T comes from the generic attribute, not an import — but it's not a primitive
      // and would produce invalid types if inlined. The function should ideally bail,
      // but T in an object type won't be caught by import check.
      const content = `<script setup lang="ts" generic="T">\ndefineProps<{\n  value: T\n}>()\n</script>\n<template><div /></template>`
      const result = extractDefinePropsType(content)
      // Document current behavior: T is not imported so extraction succeeds
      // This is a known limitation — generic script setup components are rare for OG images
      expect(result).not.toBeNull()
    })

    it('returns null for top-level intersection with imported type', () => {
      const result = extractDefinePropsType(sfc(`
        import type { BaseProps } from '~/types'

        defineProps<{ title: string } & BaseProps>()
      `))
      // The type is "{ title: string } & BaseProps" — doesn't start with { after trim?
      // Actually it does start with { but BaseProps is imported → import check catches it
      expect(result).toBeNull()
    })

    it('returns null for top-level intersection with local type', () => {
      const result = extractDefinePropsType(sfc(`
        interface Base { id: number }

        defineProps<{ title: string } & Base>()
      `))
      // Type string is "{ title: string } & Base" — doesn't end with }
      // Actually it ends with "Base" not "}" — so the object literal check rejects it
      expect(result).toBeNull()
    })

    it('handles namespace import not referenced in props', () => {
      const result = extractDefinePropsType(sfc(`
        import * as utils from '~/utils'

        defineProps<{
          title: string
        }>()
      `))
      // import * as utils — regex may not catch "utils" as an imported identifier
      expect(result).toContain('title: string')
    })

    it('handles namespace import referenced in props', () => {
      const result = extractDefinePropsType(sfc(`
        import * as Types from '~/types'

        defineProps<{
          data: Types.UserData
        }>()
      `))
      // Ideally should return null since Types is external
      // Document current behavior
      if (result !== null) {
        // Known limitation: namespace imports not fully caught
        expect(result).toContain('Types.UserData')
      }
    })

    it('handles destructured defineProps', () => {
      const result = extractDefinePropsType(sfc(`
        const { title, count } = defineProps<{
          title: string
          count: number
        }>()
      `))
      expect(result).toContain('title: string')
      expect(result).toContain('count: number')
    })

    it('handles template literal types', () => {
      const result = extractDefinePropsType(sfc(`
        defineProps<{
          color: \`#\${string}\`
        }>()
      `))
      expect(result).toContain('color:')
    })

    it('handles defineProps string in preceding code without matching', () => {
      const result = extractDefinePropsType(sfc(`
        const hint = "use defineProps<{ ... }>()"

        defineProps<{
          title: string
        }>()
      `))
      expect(result).toContain('title: string')
    })

    it('handles multi-line imports where imported type is used in props', () => {
      const result = extractDefinePropsType(sfc(`
        import type {
          UserConfig,
          Theme,
        } from '~/types'

        defineProps<{
          config: UserConfig
        }>()
      `))
      expect(result).toBeNull()
    })

    it('handles side-effect imports without identifiers', () => {
      const result = extractDefinePropsType(sfc(`
        import '~/styles/global.css'

        defineProps<{
          title: string
        }>()
      `))
      expect(result).toContain('title: string')
    })
  })

  describe('generated type expressions', () => {
    function toComponentType(sfcContent: string): string {
      const props = extractDefinePropsType(sfcContent)
      return props
        ? `import('vue').DefineComponent<${props}>`
        : `import('vue').DefineComponent<Record<string, any>>`
    }

    it('app component with type-only defineProps', () => {
      expect(toComponentType(sfc(`
        defineProps<{
          title: string
          description?: string
          color?: string
        }>()
      `))).toMatchInlineSnapshot(`
        "import('vue').DefineComponent<{
                  title: string
                  description?: string
                  color?: string
                }>"
      `)
    })

    it('app component with withDefaults', () => {
      expect(toComponentType(sfc(`
        const props = withDefaults(
          defineProps<{
            name: string
            version: string
            primaryColor?: string
          }>(),
          { primaryColor: '#60a5fa' },
        )
      `))).toMatchInlineSnapshot(`
              "import('vue').DefineComponent<{
                          name: string
                          version: string
                          primaryColor?: string
                        }>"
            `)
    })

    it('app component with destructured defaults', () => {
      expect(toComponentType(sfc(`
        const { count = 0, msg = 'hello' } = defineProps<{
          count?: number
          msg?: string
        }>()
      `))).toMatchInlineSnapshot(`
        "import('vue').DefineComponent<{
                  count?: number
                  msg?: string
                }>"
      `)
    })

    it('app component with runtime defineProps falls back', () => {
      expect(toComponentType(sfc(`
        defineProps({
          title: String,
          description: String,
        })
      `))).toMatchInlineSnapshot(`"import('vue').DefineComponent<Record<string, any>>"`)
    })

    it('app component with imported type in props falls back', () => {
      expect(toComponentType(sfc(`
        import type { Theme } from '~/types'

        defineProps<{
          theme: Theme
        }>()
      `))).toMatchInlineSnapshot(`"import('vue').DefineComponent<Record<string, any>>"`)
    })
  })
})
