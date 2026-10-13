import { mkdir, rm, writeFile } from 'node:fs/promises'
import { join } from 'pathe'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { clearTw4Cache, createTw4Provider, resolveClassesToStyles } from '../../src/build/css/providers/tw4'
import { AssetTransformPlugin } from '../../src/build/vite-asset-transform'
import { logger } from '../../src/runtime/logger'
import { runTransform } from '../unplugin'

const tmpDir = join(import.meta.dirname, '..', '.tmp-tw4-variable-warnings')
const cssPath = join(tmpDir, 'input.css')
const communityDir = join(import.meta.dirname, '../../src/runtime/app/components/Templates/Community')
const communityTemplates = import.meta.glob<string>('../../src/runtime/app/components/Templates/Community/*.vue', { query: '?raw', import: 'default', eager: true })

let warn: ReturnType<typeof vi.spyOn>

function warnings(): string[] {
  return warn.mock.calls.map(args => String(args[0]))
}

beforeAll(async () => {
  await mkdir(tmpDir, { recursive: true })
  await writeFile(cssPath, '@import "tailwindcss";')
})

beforeEach(() => {
  clearTw4Cache()
  warn = vi.spyOn(logger, 'warn').mockImplementation(() => {})
})

afterEach(() => {
  warn.mockRestore()
})

afterAll(async () => {
  clearTw4Cache()
  await rm(tmpDir, { recursive: true, force: true })
})

describe('tailwind registered properties', () => {
  it('resolves the border style that Tailwind registers with @property', async () => {
    const result = await resolveClassesToStyles(['border', 'border-4'], { cssPath }, 'BorderTemplate')
    expect(result.border).toEqual({ 'border-style': 'solid', 'border-width': '1px' })
    expect(result['border-4']).toEqual({ 'border-style': 'solid', 'border-width': '4px' })
    expect(warnings()).toEqual([])
  })

  it('uses the var() fallback when a registered property has no initial value', async () => {
    const result = await resolveClassesToStyles(['shadow-lg', 'ring-2'], { cssPath }, 'ShadowTemplate')
    expect(result['shadow-lg']?.['box-shadow']).not.toContain('initial')
    expect(result['shadow-lg']?.['box-shadow']).toContain('0 10px 15px -3px rgba(0, 0, 0, .1)')
    expect(result['ring-2']?.['box-shadow']).not.toContain('initial')
    expect(result['ring-2']?.['box-shadow']).toContain('currentcolor')
    expect(warnings()).toEqual([])
  })
})

describe('gradient utilities', () => {
  it.each([
    ['bg-gradient-to-r', 'linear-gradient(to right, '],
    ['bg-linear-to-r', 'linear-gradient(to right, '],
    ['bg-radial', 'radial-gradient(circle at center, '],
  ])('%s composes its stops without warnings', async (cls, expected) => {
    const result = await resolveClassesToStyles([cls, 'from-blue-500', 'to-purple-500'], { cssPath }, `Gradient-${cls}`)
    expect(result[cls]?.['background-image']).toContain(expected)
    expect(warnings()).toEqual([])
  })
})

describe('unresolved variable warnings', () => {
  it('names only the template that uses the class', async () => {
    await resolveClassesToStyles(['bg-[var(--og-missing)]'], { cssPath }, 'UsesMissing')
    await resolveClassesToStyles(['flex'], { cssPath }, 'UsesFlex')
    expect(warnings()).toEqual([
      '[og-image] UsesMissing: CSS variable --og-missing not found, style will be skipped',
    ])
  })

  it('names only the variables that are missing', async () => {
    await resolveClassesToStyles(['shadow-[var(--og-missing-shadow)]', 'ring-2'], { cssPath }, 'MixedShadow')
    expect(warnings()).toEqual([
      '[og-image] MixedShadow: CSS variable --og-missing-shadow not found, style will be skipped',
    ])
  })
})

describe('community templates', () => {
  it('transform with Tailwind v4 without variable warnings', async () => {
    const plugin = AssetTransformPlugin.raw({
      ogComponentPaths: [communityDir],
      rootDir: tmpDir,
      srcDir: tmpDir,
      publicDir: join(tmpDir, 'public'),
      cssProvider: createTw4Provider({
        resolveCssPath: async () => cssPath,
        loadNuxtUiColors: async () => undefined,
      }),
    }, { framework: 'vite' })

    const templates = Object.entries(communityTemplates)
    expect(templates.length).toBeGreaterThan(0)
    for (const [path, code] of templates) {
      const id = join(communityDir, path.split('/').pop()!)
      await runTransform(plugin, code, id)
    }
    expect(warnings().filter(m => m.includes('CSS variable'))).toEqual([])
  }, 60_000)
})
