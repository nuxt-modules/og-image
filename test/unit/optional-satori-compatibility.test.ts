import type { Resolver } from '@nuxt/kit'
import type { NitroConfig } from 'nitropack/config'
import type { RendererType } from '../../src/runtime/types'
import { describe, expect, it, vi } from 'vitest'
import { applyNitroPresetCompatibility } from '../../src/compatibility'

vi.mock('@nuxt/kit', () => ({
  addTemplate: vi.fn(),
  useNuxt: () => ({ options: { dev: false, nitro: { static: false } } }),
}))
vi.mock('../../src/kit', () => ({ resolveNitroPreset: () => 'node-server' }))

const withoutSatori = {
  resolvePath: async (path: string) => {
    if (path.startsWith('satori/'))
      throw new Error('Satori is not installed')
    return path
  },
} as Resolver

describe('optional Satori compatibility', () => {
  it.each([['takumi', 'node'], ['browser', 'on-demand']] as const)('configures %s without installing Satori', async (renderer, binding) => {
    const config: NitroConfig = { alias: {}, virtual: {} }
    const result = await applyNitroPresetCompatibility(config, {
      resolve: withoutSatori,
      detectedRenderers: new Set<RendererType>([renderer]),
    })

    expect(result.satori).toBe(false)
    expect(result[renderer]).toBe(binding)
    expect(config.alias?.['#og-image/bindings/satori']).toBe('./runtime/mock/empty')
  })

  it('configures a disabled Satori binding without installing Satori', async () => {
    const result = await applyNitroPresetCompatibility({ alias: {}, virtual: {} }, {
      resolve: withoutSatori,
      detectedRenderers: new Set<RendererType>(['satori']),
      compatibility: { satori: false },
    })

    expect(result.satori).toBe(false)
  })
})
