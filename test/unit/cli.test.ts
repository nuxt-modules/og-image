import { execSync } from 'node:child_process'
import { existsSync, mkdirSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

const cliPath = join(__dirname, '../../dist/cli.mjs')
const tmpDir = join(__dirname, '../.tmp-cli-test')

function runCli(args: string, cwd = tmpDir) {
  return execSync(`node ${cliPath} ${args}`, { cwd, encoding: 'utf-8' })
}

describe('cli', () => {
  beforeEach(() => {
    if (existsSync(tmpDir))
      rmSync(tmpDir, { recursive: true })
    mkdirSync(tmpDir, { recursive: true })
  })

  afterEach(() => {
    if (existsSync(tmpDir))
      rmSync(tmpDir, { recursive: true })
  })

  describe('list', () => {
    it('lists available community templates', () => {
      const output = runCli('list')
      expect(output).toContain('Available community templates')
      expect(output).toContain('NuxtSeo')
      expect(output).toContain('Brutalist')
      expect(output).toContain('npx nuxt-og-image eject')
    })
  })

  describe('eject', () => {
    it('ejects template to components/OgImage', () => {
      const output = runCli('eject NuxtSeo')
      expect(output).toContain('Ejected "NuxtSeo"')
      expect(existsSync(join(tmpDir, 'components/OgImage/NuxtSeo.vue'))).toBe(true)
    })

    it('ejects to app/components/OgImage when app/ exists (Nuxt v4)', () => {
      mkdirSync(join(tmpDir, 'app'), { recursive: true })
      const output = runCli('eject NuxtSeo')
      expect(output).toContain('Ejected "NuxtSeo"')
      expect(existsSync(join(tmpDir, 'app/components/OgImage/NuxtSeo.vue'))).toBe(true)
      expect(existsSync(join(tmpDir, 'components/OgImage/NuxtSeo.vue'))).toBe(false)
    })

    it('fails for non-existent template', () => {
      expect(() => runCli('eject NonExistent')).toThrow()
    })

    it('fails if file already exists', () => {
      runCli('eject NuxtSeo')
      expect(() => runCli('eject NuxtSeo')).toThrow()
    })
  })

  describe('help', () => {
    it('shows help with no args', () => {
      const output = runCli('')
      expect(output).toContain('nuxt-og-image CLI')
      expect(output).toContain('list')
      expect(output).toContain('eject')
    })
  })
})
