import { execSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
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
      expect(output).toContain('Available')
      expect(output).toContain('NuxtSeo')
      expect(output).toContain('Brutalist')
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

  describe('create', () => {
    it('creates component with specified renderer', () => {
      const output = runCli('create MyCard --renderer takumi')
      expect(output).toContain('Created')
      expect(existsSync(join(tmpDir, 'components/OgImage/MyCard.takumi.vue'))).toBe(true)
      const content = readFileSync(join(tmpDir, 'components/OgImage/MyCard.takumi.vue'), 'utf-8')
      expect(content).toContain('defineProps')
      expect(content).toContain('title')
    })

    it('creates component in app/ directory for Nuxt v4', () => {
      mkdirSync(join(tmpDir, 'app'), { recursive: true })
      runCli('create Blog --renderer satori')
      expect(existsSync(join(tmpDir, 'app/components/OgImage/Blog.satori.vue'))).toBe(true)
    })

    it('creates satori component with inline styles', () => {
      runCli('create Card --renderer satori')
      const content = readFileSync(join(tmpDir, 'components/OgImage/Card.satori.vue'), 'utf-8')
      expect(content).toContain(':style=')
      expect(content).not.toContain('class=')
    })

    it('creates component with scoped CSS when no framework detected', () => {
      runCli('create Card --renderer takumi')
      const content = readFileSync(join(tmpDir, 'components/OgImage/Card.takumi.vue'), 'utf-8')
      expect(content).toContain('<style scoped>')
      expect(content).not.toContain('class="w-full')
    })

    it('creates component with utility classes when tailwind detected', () => {
      writeFileSync(join(tmpDir, 'package.json'), JSON.stringify({ dependencies: { tailwindcss: '*' } }))
      runCli('create Card --renderer takumi')
      const content = readFileSync(join(tmpDir, 'components/OgImage/Card.takumi.vue'), 'utf-8')
      expect(content).toContain('class="w-full')
      expect(content).not.toContain('<style')
    })

    it('creates component with utility classes when unocss detected', () => {
      writeFileSync(join(tmpDir, 'package.json'), JSON.stringify({ devDependencies: { '@unocss/nuxt': '*' } }))
      runCli('create Card --renderer takumi')
      const content = readFileSync(join(tmpDir, 'components/OgImage/Card.takumi.vue'), 'utf-8')
      expect(content).toContain('class="w-full')
    })

    it('respects --path flag', () => {
      runCli('create Custom --renderer takumi --path components/special')
      expect(existsSync(join(tmpDir, 'components/special/Custom.takumi.vue'))).toBe(true)
    })

    it('fails if file already exists', () => {
      runCli('create Dupe --renderer takumi')
      expect(() => runCli('create Dupe --renderer takumi')).toThrow()
    })

    it('uses reactive prop destructure', () => {
      runCli('create Modern --renderer takumi')
      const content = readFileSync(join(tmpDir, 'components/OgImage/Modern.takumi.vue'), 'utf-8')
      expect(content).toContain('const { title =')
      expect(content).not.toContain('withDefaults')
    })
  })

  describe('help', () => {
    it('shows help with no args', () => {
      const output = runCli('')
      expect(output).toContain('nuxt-og-image')
      expect(output).toContain('list')
      expect(output).toContain('eject')
      expect(output).toContain('migrate v6')
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

    it('renames .chromium.vue to .browser.vue', () => {
      const ogDir = join(tmpDir, 'components/OgImage')
      mkdirSync(ogDir, { recursive: true })
      writeFileSync(join(ogDir, 'Screenshot.chromium.vue'), '<template>test</template>')

      runCli('migrate v6 --yes')
      expect(existsSync(join(ogDir, 'Screenshot.browser.vue'))).toBe(true)
      expect(existsSync(join(ogDir, 'Screenshot.chromium.vue'))).toBe(false)
      // Should not create a double-suffix file
      expect(existsSync(join(ogDir, 'Screenshot.chromium.takumi.vue'))).toBe(false)
    })

    it('migrates <OgImage /> to composable comment', () => {
      const pageFile = join(tmpDir, 'page.vue')
      writeFileSync(pageFile, `<template>\n  <OgImage title="Hello" />\n</template>`)

      runCli('migrate v6 --yes')
      const content = readFileSync(pageFile, 'utf-8')
      expect(content).toContain('<!-- Migrated: use defineOgImage(')
      expect(content).not.toContain('<OgImage')
    })

    it('migrates <OgImageScreenshot /> to composable comment', () => {
      const pageFile = join(tmpDir, 'page.vue')
      writeFileSync(pageFile, `<template>\n  <OgImageScreenshot />\n</template>`)

      runCli('migrate v6 --yes')
      const content = readFileSync(pageFile, 'utf-8')
      expect(content).toContain('<!-- Migrated: use defineOgImageScreenshot()')
      expect(content).not.toContain('<OgImageScreenshot')
    })

    it('migrates defineOgImageComponent to defineOgImage', () => {
      const pageFile = join(tmpDir, 'page.vue')
      writeFileSync(pageFile, `<script setup>\ndefineOgImageComponent('NuxtSeo', { title: 'Hello' })\n</script>`)

      runCli('migrate v6 --yes')
      const content = readFileSync(pageFile, 'utf-8')
      expect(content).toContain('defineOgImage(')
      expect(content).not.toContain('defineOgImageComponent')
    })

    it('migrates defineOgImage({ renderer: chromium }) to defineOgImageScreenshot', () => {
      const pageFile = join(tmpDir, 'page.vue')
      writeFileSync(pageFile, `<script setup>\ndefineOgImage({ renderer: 'chromium' })\n</script>`)

      runCli('migrate v6 --yes')
      const content = readFileSync(pageFile, 'utf-8')
      expect(content).toContain('defineOgImageScreenshot()')
      expect(content).not.toContain('chromium')
    })

    it('migrates #nuxt-og-image-utils import path', () => {
      const utilFile = join(tmpDir, 'util.ts')
      writeFileSync(utilFile, `import { something } from '#nuxt-og-image-utils'`)

      runCli('migrate v6 --yes')
      const content = readFileSync(utilFile, 'utf-8')
      expect(content).toContain('#og-image/shared')
      expect(content).not.toContain('#nuxt-og-image-utils')
    })

    it('migrates useOgImageRuntimeConfig import path', () => {
      const utilFile = join(tmpDir, 'util.ts')
      writeFileSync(utilFile, `import { useOgImageRuntimeConfig } from '#og-image/shared'`)

      runCli('migrate v6 --yes')
      const content = readFileSync(utilFile, 'utf-8')
      expect(content).toContain(`from '#og-image/app/utils'`)
      expect(content).not.toContain(`from '#og-image/shared'`)
    })
  })
})
