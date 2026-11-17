import { fileURLToPath } from 'node:url'
import { resolve } from 'pathe'
import { resolveConfig } from 'vite'
import { describe, expect, it } from 'vitest'
import { AssetTransformPlugin } from '../../src/build/vite-asset-transform'
import { runTransform } from '../unplugin'

const root = fileURLToPath(new URL('../../', import.meta.url))
const fixtures = resolve(root, 'test/fixtures/build-transforms')

describe.each(['serve', 'build'] as const)('style preprocessing in %s', (command) => {
  it.each([
    ['less', '@import "og-tokens/style-tokens.less"; .card { color: @primary; width: @width; }', '@width: 42px;'],
    ['scss', '@use "../assets/style-tokens.scss" as *; .card { color: $primary; width: $width; }', '$width: 42px;'],
    ['css', '.card { color: red; width: 42px; }', ''],
  ])('inlines %s for every renderer and nested components', async (lang, styles, additionalData) => {
    const plugin = AssetTransformPlugin.raw({
      ogComponentPaths: [resolve(fixtures, 'components')],
      rootDir: root,
      srcDir: root,
      publicDir: resolve(fixtures, 'public'),
    }, { framework: 'vite', versions: {} })
    await resolveConfig({
      configFile: false,
      root,
      resolve: { alias: { 'og-tokens': resolve(fixtures, 'assets') } },
      css: { preprocessorOptions: { [lang]: { additionalData } } },
      plugins: [{ name: 'initialize-og-transform', ...plugin.vite }],
    }, command)

    for (const suffix of ['takumi', 'satori', 'browser', 'nested']) {
      const id = suffix === 'nested'
        ? `${resolve(fixtures, 'shared/Shared.vue')}?og-image-depth=1`
        : resolve(fixtures, `components/Test.${suffix}.vue`)
      const dependencies: string[] = []
      const result = await runTransform(plugin, `<template><div class="card" /></template>
<style lang="${lang}" scoped>${styles}</style>`, id, { addWatchFile: (file: string) => dependencies.push(file) })
      expect(result?.code).toContain('color:red')
      expect(result?.code).toContain('width:42px')
      expect(result?.code).not.toContain('<style')
      if (lang !== 'css')
        expect(dependencies).toContain(resolve(fixtures, `assets/style-tokens.${lang}`))
    }
  })
})
