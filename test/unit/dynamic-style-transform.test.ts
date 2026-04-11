import { describe, expect, it } from 'vitest'
import { transformVueTemplate } from '../../src/build/vue-template-transform'

const noopResolve = async () => ({} as Record<string, Record<string, string>>)

function wrapSfc(template: string): string {
  return `<template>${template}</template>\n<script setup lang="ts"></script>`
}

function extractTemplate(code: string): string {
  const start = code.indexOf('<template>') + '<template>'.length
  const end = code.indexOf('</template>')
  return code.slice(start, end)
}

describe(':style object literal transform', () => {
  it('converts simple :style object to inline style', async () => {
    const input = wrapSfc(`<div :style="{ width: '32px', height: '32px' }">hello</div>`)
    const result = await transformVueTemplate(input, { resolveStyles: noopResolve })
    expect(result).toBeDefined()
    const template = extractTemplate(result!.code)
    expect(template).toContain('style="width: 32px; height: 32px"')
    expect(template).not.toContain(':style')
  })

  it('converts camelCase properties to kebab-case', async () => {
    const input = wrapSfc(`<div :style="{ fontSize: '14px', backgroundColor: 'red' }">text</div>`)
    const result = await transformVueTemplate(input, { resolveStyles: noopResolve })
    expect(result).toBeDefined()
    const template = extractTemplate(result!.code)
    expect(template).toContain('font-size: 14px')
    expect(template).toContain('background-color: red')
  })

  it('merges :style with existing static style (dynamic takes precedence)', async () => {
    const input = wrapSfc(`<div style="color: blue" :style="{ color: 'red', width: '100px' }">text</div>`)
    const result = await transformVueTemplate(input, { resolveStyles: noopResolve })
    expect(result).toBeDefined()
    const template = extractTemplate(result!.code)
    // :style should override static style for same property
    expect(template).toContain('color: red')
    expect(template).toContain('width: 100px')
    expect(template).not.toContain(':style')
  })

  it('merges :style with resolved class styles', async () => {
    const resolve = async (classes: string[]) => {
      const map: Record<string, Record<string, string>> = {}
      for (const cls of classes) {
        if (cls === 'flex')
          map[cls] = { display: 'flex' }
      }
      return map
    }
    const input = wrapSfc(`<div class="flex" :style="{ gap: '8px' }">text</div>`)
    const result = await transformVueTemplate(input, { resolveStyles: resolve })
    expect(result).toBeDefined()
    const template = extractTemplate(result!.code)
    expect(template).toContain('display: flex')
    expect(template).toContain('gap: 8px')
    expect(template).not.toContain(':style')
  })

  it('skips dynamic expressions (variable references)', async () => {
    const input = wrapSfc(`<div :style="{ width: myWidth }">text</div>`)
    const result = await transformVueTemplate(input, { resolveStyles: noopResolve })
    // Should not transform since the value is dynamic
    expect(result).toBeUndefined()
  })

  it('handles numeric values without units', async () => {
    const input = wrapSfc(`<div :style="{ opacity: 0.5, zIndex: 10 }">text</div>`)
    const result = await transformVueTemplate(input, { resolveStyles: noopResolve })
    expect(result).toBeDefined()
    const template = extractTemplate(result!.code)
    expect(template).toContain('opacity: 0.5')
    expect(template).toContain('z-index: 10')
  })

  it('handles single-property objects', async () => {
    const input = wrapSfc(`<div :style="{ width: '100%' }">text</div>`)
    const result = await transformVueTemplate(input, { resolveStyles: noopResolve })
    expect(result).toBeDefined()
    const template = extractTemplate(result!.code)
    expect(template).toContain('style="width: 100%"')
  })

  it('skips non-object :style bindings (string expressions)', async () => {
    const input = wrapSfc(`<div :style="myStyleObj">text</div>`)
    const result = await transformVueTemplate(input, { resolveStyles: noopResolve })
    // Not an object literal, should not transform
    expect(result).toBeUndefined()
  })
})
