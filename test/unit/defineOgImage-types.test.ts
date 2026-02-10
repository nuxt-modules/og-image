import type { Component, DefineComponent, MaybeRefOrGetter } from 'vue'
import type { ExtractComponentProps, ReactiveComponentProps } from '../../src/runtime/types'
import { execSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'pathe'
import { describe, expect, expectTypeOf, it } from 'vitest'

// ---------------------------------------------------------------------------
// E2E: validate the real generated types from the basic fixture
// Gate-checked — skips if `nuxi prepare` hasn't been run on the fixture
// ---------------------------------------------------------------------------

const FIXTURE_ROOT = resolve(__dirname, '../fixtures/basic')
const GENERATED_DTS = resolve(FIXTURE_ROOT, '.nuxt/module/nuxt-og-image-components.d.ts')
const TYPETEST_TSCONFIG = resolve(FIXTURE_ROOT, 'tsconfig.typetest.json')
const TYPETEST_INVALID_TSCONFIG = resolve(FIXTURE_ROOT, 'tsconfig.typetest-invalid.json')
const fixtureReady = existsSync(GENERATED_DTS) && existsSync(TYPETEST_TSCONFIG)

describe.skipIf(!fixtureReady)('generated component types (basic fixture)', () => {
  const dtsContent = fixtureReady ? readFileSync(GENERATED_DTS, 'utf-8') : ''

  it('declares the #og-image/components module', () => {
    expect(dtsContent).toContain(`declare module '#og-image/components'`)
    expect(dtsContent).toContain('export interface OgImageComponents')
  })

  it('uses typeof import for app components (not inline DefineComponent)', () => {
    const lines = dtsContent.split('\n').filter(l => l.includes(`'CustomFonts':`))
    expect(lines.length).toBeGreaterThan(0)
    for (const line of lines) {
      expect(line).toContain(`typeof import(`)
      expect(line).toContain(`.vue')['default']`)
      expect(line).not.toContain('DefineComponent<{')
    }
  })

  it('uses typeof import for community components', () => {
    const lines = dtsContent.split('\n').filter(l => l.includes(`'NuxtSeo.satori':`))
    expect(lines.length).toBeGreaterThan(0)
    for (const line of lines) {
      expect(line).toContain(`typeof import(`)
    }
  })

  it('registers expected app component name variants', () => {
    expect(dtsContent).toContain(`'CustomFontsSatori':`)
    expect(dtsContent).toContain(`'CustomFonts.satori':`)
    expect(dtsContent).toContain(`'CustomFonts':`)
  })

  it('registers dot-notation for ambiguous components', () => {
    expect(dtsContent).toContain(`'ComplexTest.satori':`)
    expect(dtsContent).toContain(`'ComplexTest.takumi':`)
  })

  it('has no inline DefineComponent<{ (all use typeof import)', () => {
    const inlineMatches = dtsContent.match(/DefineComponent<\{/g)
    expect(inlineMatches).toBeNull()
  })

  it('is NOT referenced from nuxt.d.ts (avoids circular dep)', () => {
    const nuxtDts = resolve(FIXTURE_ROOT, '.nuxt/nuxt.d.ts')
    if (!existsSync(nuxtDts))
      return
    expect(readFileSync(nuxtDts, 'utf-8')).not.toContain('og-image-components')
  })

  it('is included in tsconfig (loaded independently after globals)', () => {
    const tsconfig = resolve(FIXTURE_ROOT, '.nuxt/tsconfig.json')
    if (!existsSync(tsconfig))
      return
    expect(readFileSync(tsconfig, 'utf-8')).toContain('nuxt-og-image-components.d.ts')
  })

  it('type-checks valid defineOgImage calls via vue-tsc', () => {
    const result = execSync(
      `pnpm vue-tsc --noEmit --project ${TYPETEST_TSCONFIG}`,
      { encoding: 'utf-8', stdio: 'pipe', cwd: resolve(__dirname, '../..') },
    )
    expect(result).toBe('')
  }, 60_000)

  it('rejects invalid defineOgImage calls via vue-tsc', () => {
    let stderr = ''
    try {
      execSync(
        `pnpm vue-tsc --noEmit --project ${TYPETEST_INVALID_TSCONFIG}`,
        { encoding: 'utf-8', stdio: 'pipe', cwd: resolve(__dirname, '../..') },
      )
      expect.unreachable('vue-tsc should have failed')
    }
    catch (e: any) {
      stderr = e.stdout || e.stderr || ''
    }
    // Invalid component name
    expect(stderr).toContain('"DoesNotExist"')
    expect(stderr).toContain('keyof OgImageComponents')
    // Wrong prop type (number instead of string)
    expect(stderr).toContain('title')
    expect(stderr).toContain('number')
    // Invalid union value ('blue' not in 'dark' | 'light')
    expect(stderr).toContain('"blue"')
    expect(stderr).toContain('"light" | "dark"')
  }, 60_000)
})

// ---------------------------------------------------------------------------
// Unit: type-level tests for the defineOgImage generic signature
// ---------------------------------------------------------------------------

type MockComponentA = DefineComponent<{ title: string, description?: string }>
type MockComponentB = DefineComponent<{ name: string, count: number, color?: string }>
type MockComponentFallback = DefineComponent<Record<string, any>>

interface TestOgImageComponents {
  'Banner': MockComponentA
  'Banner.satori': MockComponentA
  'Stats': MockComponentB
  'Stats.satori': MockComponentB
  'Legacy': MockComponentFallback
}

type TestReactiveComponentProps<T extends Component> = {
  [K in keyof ExtractComponentProps<T>]?: MaybeRefOrGetter<ExtractComponentProps<T>[K]>
}

interface TestOgImageComponentOptions<T extends keyof TestOgImageComponents> {
  props?: TestReactiveComponentProps<TestOgImageComponents[T]>
}

function testDefineOgImage<T extends keyof TestOgImageComponents>(
  _component: T,
  _propsOrOptions?: TestReactiveComponentProps<TestOgImageComponents[T]> | TestOgImageComponentOptions<T>[],
): string[] {
  return []
}

describe('defineOgImage type safety', () => {
  describe('component name constraint', () => {
    it('accepts valid component names', () => {
      expectTypeOf(testDefineOgImage).toBeCallableWith('Banner', { title: 'Hello' })
      expectTypeOf(testDefineOgImage).toBeCallableWith('Banner.satori', { title: 'Hello' })
      expectTypeOf(testDefineOgImage).toBeCallableWith('Stats', { name: 'Test', count: 1 })
    })

    it('rejects invalid component names', () => {
      expectTypeOf(testDefineOgImage).parameter(0).not.toEqualTypeOf<'NonExistent'>()
    })
  })

  describe('props inference from DefineComponent', () => {
    it('infers required props', () => {
      expectTypeOf(testDefineOgImage).toBeCallableWith('Banner', { title: 'Hello' })
    })

    it('infers optional props', () => {
      expectTypeOf(testDefineOgImage).toBeCallableWith('Banner', { title: 'Hello', description: 'World' })
    })

    it('infers multiple required props', () => {
      expectTypeOf(testDefineOgImage).toBeCallableWith('Stats', { name: 'Test', count: 42 })
    })
  })

  describe('reactive props (MaybeRefOrGetter)', () => {
    it('accepts ref-like values for props', () => {
      type BannerProps = TestReactiveComponentProps<MockComponentA>
      expectTypeOf<BannerProps>().toExtend<{
        title?: MaybeRefOrGetter<string>
        description?: MaybeRefOrGetter<string | undefined>
      }>()
    })

    it('accepts getter functions for props', () => {
      expectTypeOf(testDefineOgImage).toBeCallableWith('Banner', {
        title: () => 'computed title',
      })
    })
  })

  describe('fallback component (Record<string, any>)', () => {
    it('accepts any props for fallback components', () => {
      expectTypeOf(testDefineOgImage).toBeCallableWith('Legacy', { anything: 'goes', here: 123 })
    })
  })

  describe('array options overload', () => {
    it('accepts array of options with props', () => {
      testDefineOgImage('Banner', [
        { props: { title: 'Image 1' } },
        { props: { title: 'Image 2', description: 'Desc' } },
      ])
    })
  })
})

describe('extractComponentProps', () => {
  it('extracts props excluding vue internals', () => {
    type Props = ExtractComponentProps<MockComponentA>
    expectTypeOf<Props>().toEqualTypeOf<{ title: string, description?: string }>()
  })

  it('handles Record<string, any> fallback', () => {
    type Props = ExtractComponentProps<MockComponentFallback>
    expectTypeOf<Props>().toExtend<Record<string, any>>()
  })
})

describe('reactiveComponentProps', () => {
  it('wraps props in MaybeRefOrGetter', () => {
    type Props = ReactiveComponentProps<MockComponentA>
    expectTypeOf<Props>().toExtend<{
      title?: MaybeRefOrGetter<string>
    }>()
  })
})
