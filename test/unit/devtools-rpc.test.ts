import type { Nuxt } from 'nuxt/schema'
import type { ModuleOptions } from '../../src/module'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { setupDevToolsUI } from '../../src/build/devtools'

const { refreshRouteData, setupDevToolsRpc } = vi.hoisted(() => {
  const refreshRouteData = Object.assign(
    vi.fn().mockRejectedValue(new Error('RPC timeout')),
    { asEvent: vi.fn().mockResolvedValue(undefined) },
  )

  return {
    refreshRouteData,
    setupDevToolsRpc: vi.fn().mockResolvedValue({
      broadcast: {
        refresh: Object.assign(vi.fn(), { asEvent: vi.fn() }),
        refreshGlobalData: Object.assign(vi.fn(), { asEvent: vi.fn() }),
        refreshRouteData,
      },
    }),
  }
})

vi.mock('@nuxt/kit', () => ({
  updateTemplates: vi.fn(),
  useNuxt: vi.fn(),
}))

vi.mock('nuxtseo-shared/devtools', () => ({
  setupDevToolsRpc,
  setupDevToolsUI: vi.fn(),
}))

describe('devtools RPC broadcasts', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('sends route refreshes as events without waiting for a response', async () => {
    const callbacks = new Map<string, (...args: any[]) => unknown>()
    const hook = vi.fn((name: string, callback: (...args: any[]) => unknown) => {
      callbacks.set(name, callback)
    })
    const nuxt = {
      hook,
      hooks: { hook },
      options: {
        css: [],
        rootDir: '/project',
        srcDir: '/project/app',
      },
    } as unknown as Nuxt

    setupDevToolsUI(
      { componentDirs: [] } as unknown as ModuleOptions,
      path => path,
      nuxt,
    )

    await vi.waitFor(() => expect(callbacks.has('builder:watch')).toBe(true))
    callbacks.get('builder:watch')!('change', 'pages/index.vue')

    expect(refreshRouteData).not.toHaveBeenCalled()
    expect(refreshRouteData.asEvent).toHaveBeenCalledWith('pages/index.vue')
  })
})
