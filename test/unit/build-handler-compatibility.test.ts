import type { Nuxt } from '@nuxt/schema'
import type { RendererType } from '../../src/runtime/types'
import { describe, expect, it, vi } from 'vitest'

const compatibilityApplications = vi.hoisted(() => [] as RendererType[][])

vi.mock('../../src/compatibility', () => ({
  applyNitroPresetCompatibility: vi.fn(async (_config, options: { detectedRenderers: Set<RendererType> }) => {
    compatibilityApplications.push([...options.detectedRenderers])
  }),
  getPresetNitroPresetCompatibility: vi.fn(() => ({})),
  resolveOgImagePreset: vi.fn(() => 'node-server'),
}))

vi.mock('../../src/utils/dependencies', () => ({
  getMissingDependencies: vi.fn(async () => ['not-installed']),
  getRecommendedBinding: vi.fn(() => 'node'),
}))

const { setupBuildHandler } = await import('../../src/build/build')
const { setupDevHandler } = await import('../../src/build/dev')

function createNuxtHarness() {
  const hooks = new Map<string, (...args: any[]) => any>()
  const nuxt = {
    hooks: {
      hook: vi.fn((name: string, callback: (...args: any[]) => any) => hooks.set(name, callback)),
    },
    options: {
      nitro: {
        preset: 'node-server',
      },
    },
  } as unknown as Nuxt
  return { hooks, nuxt }
}

describe('build handler compatibility', () => {
  it('reapplies compatibility for renderers discovered after module setup', async () => {
    compatibilityApplications.length = 0
    const { hooks, nuxt } = createNuxtHarness()
    const detectedRenderers = new Set<RendererType>()

    await setupBuildHandler(
      { runtimeCacheStorage: false } as any,
      { resolvePath: vi.fn(async path => path) } as any,
      () => detectedRenderers,
      () => ({}),
      nuxt,
    )
    detectedRenderers.add('satori')

    await hooks.get('nitro:init')?.({
      hooks: { hook: vi.fn() },
      options: nuxt.options.nitro,
    })

    expect(compatibilityApplications).toEqual([
      [],
      ['satori'],
    ])
  })

  it('reapplies development compatibility for late renderers', async () => {
    compatibilityApplications.length = 0
    const { hooks, nuxt } = createNuxtHarness()
    const detectedRenderers = new Set<RendererType>()

    await setupDevHandler(
      {} as any,
      {} as any,
      () => detectedRenderers,
      () => ({}),
      nuxt,
    )
    detectedRenderers.add('browser')

    await hooks.get('nitro:init')?.({ options: nuxt.options.nitro })

    expect(compatibilityApplications).toEqual([
      [],
      ['browser'],
    ])
  })
})
