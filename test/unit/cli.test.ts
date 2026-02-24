import { execSync } from 'node:child_process'
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'pathe'
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
    it('ejects template to components/OgImage with renderer suffix', () => {
      const output = runCli('eject NuxtSeo')
      expect(output).toContain('Ejected "NuxtSeo"')
      expect(existsSync(join(tmpDir, 'components/OgImage/NuxtSeo.satori.vue'))).toBe(true)
    })

    it('ejects to app/components/OgImage when app/ exists (Nuxt v4)', () => {
      mkdirSync(join(tmpDir, 'app'), { recursive: true })
      const output = runCli('eject NuxtSeo')
      expect(output).toContain('Ejected "NuxtSeo"')
      expect(existsSync(join(tmpDir, 'app/components/OgImage/NuxtSeo.satori.vue'))).toBe(true)
      expect(existsSync(join(tmpDir, 'components/OgImage/NuxtSeo.satori.vue'))).toBe(false)
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
      expect(output).toContain('migrate v6')
      expect(output).toContain('--renderer')
    })
  })

  describe('migrate v6', { timeout: 30_000 }, () => {
    it('renames components to .takumi.vue by default', () => {
      const ogDir = join(tmpDir, 'components/OgImage')
      mkdirSync(ogDir, { recursive: true })
      writeFileSync(join(ogDir, 'Default.vue'), '<template>test</template>')
      writeFileSync(join(ogDir, 'Blog.vue'), '<template>blog</template>')

      const output = runCli('migrate v6 --yes')
      expect(output).toContain('Migration complete')
      expect(existsSync(join(ogDir, 'Default.takumi.vue'))).toBe(true)
      expect(existsSync(join(ogDir, 'Blog.takumi.vue'))).toBe(true)
      expect(existsSync(join(ogDir, 'Default.vue'))).toBe(false)
    })

    it('respects --renderer flag', () => {
      const ogDir = join(tmpDir, 'components/OgImage')
      mkdirSync(ogDir, { recursive: true })
      writeFileSync(join(ogDir, 'Screenshot.vue'), '<template>test</template>')

      runCli('migrate v6 --renderer browser --yes')
      expect(existsSync(join(ogDir, 'Screenshot.browser.vue'))).toBe(true)
    })

    it('--dry-run does not rename files', () => {
      const ogDir = join(tmpDir, 'components/OgImage')
      mkdirSync(ogDir, { recursive: true })
      writeFileSync(join(ogDir, 'Default.vue'), '<template>test</template>')

      const output = runCli('migrate v6 --dry-run --yes')
      expect(output).toContain('Default.vue')
      expect(output).toContain('Default.takumi.vue')
      expect(output).toContain('Dry run')
      expect(existsSync(join(ogDir, 'Default.vue'))).toBe(true)
      expect(existsSync(join(ogDir, 'Default.takumi.vue'))).toBe(false)
    })

    it('skips component rename when already have suffix', () => {
      const ogDir = join(tmpDir, 'components/OgImage')
      mkdirSync(ogDir, { recursive: true })
      writeFileSync(join(ogDir, 'Default.satori.vue'), '<template>test</template>')

      const output = runCli('migrate v6 --yes')
      // Should not mention renaming since all components already have suffix
      expect(output).not.toContain('Rename')
      expect(output).not.toContain('Renamed')
      // Should still complete migration
      expect(output).toContain('Migration complete')
    })

    it('handles app/ directory for Nuxt v4', () => {
      const ogDir = join(tmpDir, 'app/components/OgImage')
      mkdirSync(ogDir, { recursive: true })
      writeFileSync(join(ogDir, 'Default.vue'), '<template>test</template>')

      runCli('migrate v6 --yes')
      expect(existsSync(join(ogDir, 'Default.takumi.vue'))).toBe(true)
    })
  })
})
