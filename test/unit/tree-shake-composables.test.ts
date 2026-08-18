import { describe, expect, it } from 'vitest'
import { TreeShakeComposablesPlugin } from '../../src/build/tree-shake-plugin'
import { runTransform } from '../unplugin'

const plugin = TreeShakeComposablesPlugin.raw(undefined, { framework: 'vite' })

const CALL = `defineOgImage({ component: 'Test' })`

describe('tree-shake composables plugin', () => {
  describe('module scope', () => {
    it.each([
      'app/og.ts',
      'app/og.mts',
      'app/og.cts',
      'app/og.mjs',
      'app/og.cjs',
      'app/og.jsx',
      'app/og.tsx',
      'app/og.ts?t=1699999999999',
      'app/Page.vue',
      'app/Page.vue?vue&type=script&setup=true&lang.ts',
      'app/Page.vue?macro=true',
    ])('tree-shakes %s', async (id) => {
      const result = await runTransform(plugin, CALL, id)
      expect(result?.code).toBe(` import.meta.prerender && ${CALL}`)
    })

    it.each([
      // Only the script block of an SFC is ours.
      'app/Page.vue?vue&type=style&index=0&lang.css',
      'app/Page.vue?vue&type=template',
      'app/Page.vue?nuxt_component=async',
      // The island registry re-exports every component and must stay intact.
      'app/.nuxt/components.islands.mjs',
      // Not a module the bundler hands us as JS.
      'app/styles.css',
    ])('leaves %s alone', async (id) => {
      expect(await runTransform(plugin, CALL, id)).toBeUndefined()
    })
  })

  describe('rewrite', () => {
    it('guards every composable in the module', async () => {
      const code = [
        `defineOgImage({ component: 'A' })`,
        `defineOgImageComponent('B')`,
        `defineOgImageScreenshot()`,
      ].join('\n')

      const result = await runTransform(plugin, code, 'app/og.ts')
      expect(result?.code).toBe([
        ` import.meta.prerender && defineOgImage({ component: 'A' })`,
        ` import.meta.prerender && defineOgImageComponent('B')`,
        ` import.meta.prerender && defineOgImageScreenshot()`,
      ].join('\n'))
    })

    it('leaves a module that only names the composable alone', async () => {
      expect(await runTransform(plugin, `export const helper = defineOgImage`, 'app/og.ts')).toBeUndefined()
    })

    it('leaves a call inside a string literal alone', async () => {
      expect(await runTransform(plugin, `export const doc = \`\ndefineOgImage({})\n\``, 'app/og.ts')).toBeUndefined()
    })
  })
})
