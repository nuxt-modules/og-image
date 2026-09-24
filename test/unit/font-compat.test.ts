import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import { fontFamiliesFromCssEntries, fontsResolvedHookAvailable, warnWhenFontsUnreported } from '../../src/build/font-compat'

function createNuxt(options: { dev?: boolean, families?: unknown[] } = {}) {
  const hooks: Record<string, () => unknown | Promise<unknown>> = {}
  const logger = { debug: vi.fn(), info: vi.fn(), warn: vi.fn() }
  const nuxt = {
    hook: (name: string, fn: () => unknown | Promise<unknown>) => {
      hooks[name] = fn
    },
    options: { dev: options.dev ?? false, fonts: { families: options.families ?? [] } },
  }
  return { hooks, logger, nuxt }
}

function registerWarning(nuxt: any, logger: any, overrides: Record<string, unknown> = {}) {
  warnWhenFontsUnreported({
    nuxt,
    logger,
    fontState: { resolvedFaces: new Map() },
    expectedFamilies: () => [],
    ...overrides,
  })
}

describe('fontsResolvedHookAvailable', () => {
  it('detects the hook in an installed hook-bearing package', () => {
    const dir = mkdtempSync(join(tmpdir(), 'og-image-font-compat-'))
    try {
      writeFileSync(join(dir, 'module.mjs'), 'nuxt.callHook("fonts:resolved", resolved)')
      expect(fontsResolvedHookAvailable(join(dir, 'module.mjs'))).toBe(true)
    }
    finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it('rejects a package that never calls the hook', () => {
    const dir = mkdtempSync(join(tmpdir(), 'og-image-font-compat-'))
    try {
      writeFileSync(join(dir, 'module.mjs'), 'nuxt.callHook("fonts:public-asset-context", context)')
      expect(fontsResolvedHookAvailable(join(dir, 'module.mjs'))).toBe(false)
    }
    finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })
})

describe('warnWhenFontsUnreported', () => {
  it('warns in dev when the installed @nuxt/fonts cannot report fonts', async () => {
    const { hooks, logger, nuxt } = createNuxt({ dev: true, families: [{ name: 'Poppins' }] })
    registerWarning(nuxt, logger)

    await hooks['nitro:build:before']!()

    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('fonts:resolved'))
  })

  it('warns in production for a hook-less release even with CSS-only families', async () => {
    const { hooks, logger, nuxt } = createNuxt()
    registerWarning(nuxt, logger, { expectedFamilies: () => ['Poppins'] })

    await hooks['nitro:build:before']!()

    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('fonts:resolved'))
  })

  it('stays quiet in dev when the hook exists but fonts are not resolved yet', async () => {
    const { hooks, logger, nuxt } = createNuxt({ dev: true, families: [{ name: 'Poppins' }] })
    registerWarning(nuxt, logger, { fontsResolvedHook: true })

    await hooks['nitro:build:before']!()

    expect(logger.warn).not.toHaveBeenCalled()
  })

  it('stays quiet once fonts were reported', async () => {
    const { hooks, logger, nuxt } = createNuxt({ families: [{ name: 'Poppins' }] })
    registerWarning(nuxt, logger, { fontState: { resolvedFaces: new Map([['Poppins', []]]) } })

    await hooks['nitro:build:before']!()

    expect(logger.warn).not.toHaveBeenCalled()
  })

  it('stays quiet when the app uses no fonts at all', async () => {
    const { hooks, logger, nuxt } = createNuxt()
    registerWarning(nuxt, logger)

    await hooks['nitro:build:before']!()

    expect(logger.warn).not.toHaveBeenCalled()
  })
})

describe('font-family scanning', () => {
  it('reads custom families from app CSS entries', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'og-image-font-compat-css-'))
    try {
      mkdirSync(dir, { recursive: true })
      writeFileSync(join(dir, 'main.css'), 'body { font-family: "Poppins", sans-serif; }\n')
      expect(fontFamiliesFromCssEntries(['main.css'], dir)).toEqual(['Poppins'])
    }
    finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })
})
