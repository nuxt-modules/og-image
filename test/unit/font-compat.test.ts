import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import { fontFamiliesFromCssEntries, warnWhenFontsUnreported } from '../../src/build/font-compat'
import { parseAppCssFontFaces } from '../../src/build/fonts'

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

describe('warnWhenFontsUnreported', () => {
  it('warns in production when CSS-only families were not reported', async () => {
    const { hooks, logger, nuxt } = createNuxt()
    registerWarning(nuxt, logger, { expectedFamilies: () => ['Poppins'] })

    await hooks['nitro:build:before']!()

    expect(logger.warn).toHaveBeenCalledWith('@nuxt/fonts did not report any fonts, so OG images use the bundled Inter font.')
  })

  it('stays quiet in dev before fonts are resolved', async () => {
    const { hooks, logger, nuxt } = createNuxt({ dev: true, families: [{ name: 'Poppins' }] })
    registerWarning(nuxt, logger)

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

  it('maps Nuxt srcDir and rootDir aliases in CSS entries', () => {
    const rootDir = mkdtempSync(join(tmpdir(), 'og-image-font-compat-alias-'))
    const srcDir = join(rootDir, 'app')
    try {
      mkdirSync(join(srcDir, 'assets/css'), { recursive: true })
      mkdirSync(join(rootDir, 'assets/css'), { recursive: true })
      writeFileSync(join(srcDir, 'assets/css/main.css'), 'body { font-family: "Poppins", sans-serif; }\n')
      writeFileSync(join(rootDir, 'assets/css/root.css'), 'body { font-family: "Rubik", sans-serif; }\n')

      expect(fontFamiliesFromCssEntries(['@/assets/css/main.css'], srcDir, rootDir)).toEqual(['Poppins'])
      expect(fontFamiliesFromCssEntries(['~/assets/css/main.css'], srcDir, rootDir)).toEqual(['Poppins'])
      expect(fontFamiliesFromCssEntries(['~~/assets/css/root.css'], srcDir, rootDir)).toEqual(['Rubik'])
      expect(fontFamiliesFromCssEntries(['@@/assets/css/root.css'], srcDir, rootDir)).toEqual(['Rubik'])
    }
    finally {
      rmSync(rootDir, { recursive: true, force: true })
    }
  })

  it('parses @font-face from alias-resolved CSS entries', async () => {
    const rootDir = mkdtempSync(join(tmpdir(), 'og-image-font-compat-faces-'))
    const srcDir = join(rootDir, 'app')
    try {
      mkdirSync(join(srcDir, 'assets/css'), { recursive: true })
      writeFileSync(
        join(srcDir, 'assets/css/main.css'),
        '@font-face {\n  font-family: Poppins;\n  src: url("/fonts/poppins.woff2") format("woff2");\n  font-weight: 400;\n  font-style: normal;\n}\n',
      )

      const nuxt = { options: { css: ['@/assets/css/main.css'], srcDir, rootDir } }
      const fonts = await parseAppCssFontFaces(nuxt as any)

      expect(fonts.map(font => font.family)).toEqual(['Poppins'])
    }
    finally {
      rmSync(rootDir, { recursive: true, force: true })
    }
  })
})
