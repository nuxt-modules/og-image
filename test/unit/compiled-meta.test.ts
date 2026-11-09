import type { HeadCompiler } from '../../src/build/compiledMeta'
import type { OgMetaMode } from '../../src/runtime/app/compiledMeta'
import { realpathSync } from 'node:fs'
import { createRequire } from 'node:module'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { toValue } from 'vue'
import { compileMetaShapes } from '../../src/build/compiledMeta'
import { compileOgMeta, OG_META_MODES } from '../../src/runtime/app/compiledMeta'
import { generateMeta } from '../../src/runtime/shared'

// og-image reaches Unhead through @unhead/vue, so the test resolves it from there
const requireFromVue = createRequire(join(realpathSync(fileURLToPath(new URL('../../node_modules/@unhead/vue', import.meta.url))), 'package.json'))
const compiler = await import(requireFromVue.resolve('unhead/compiled')) as HeadCompiler
const { createHead: createCompiledHead } = await import(requireFromVue.resolve('unhead/compiled/server'))
const { createHead, renderSSRHead } = await import(requireFromVue.resolve('unhead/server'))
const { TemplateParamsPlugin } = await import(requireFromVue.resolve('unhead/plugins'))

const built = compileMetaShapes(compiler)
if (built._tag !== 'Ok')
  throw new Error(built.reason)
const shapes = built.shapes

function resolved(url: string, options: Record<string, any>) {
  return generateMeta(url, options as any).map(tag => ({ ...tag, content: toValue(tag.content as any) }))
}

/** Both heads hold the same page meta first, so the og:image meta must keep its priority. */
function render(push: (head: any) => void) {
  return (compiled: boolean) => {
    const head = compiled ? createCompiledHead({ disableDefaults: true }) : createHead({ disableDefaults: true })
    head.use(TemplateParamsPlugin)
    head.push({ meta: [{ property: 'og:image', content: 'https://example.com/page.png' }, { name: 'twitter:card', content: 'summary' }] })
    if (compiled)
      push(head)
    return compiled ? head.render() : renderSSRHead(head)
  }
}

describe('compileOgMeta', () => {
  const cases: [string, string, Record<string, any>][] = [
    ['og key with size', '/_og/d/a.png', { width: 1200, height: 600, extension: 'png' }],
    ['twitter key with alt', '/_og/d/b.jpeg', { key: 'twitter', alt: 'A cover', extension: 'jpeg' }],
    ['custom key', 'https://cdn.example.com/c.png', { key: 'other', width: 800 }],
  ]
  for (const mode of Object.keys(OG_META_MODES) as OgMetaMode[]) {
    for (const [name, url, options] of cases) {
      it(`renders ${name} as the normal entry does (${mode})`, () => {
        const meta = resolved(url, options)
        const compiled = compileOgMeta(shapes, mode, meta)
        expect(compiled._tag).toBe('Compiled')
        const loose = (() => {
          const head = createHead({ disableDefaults: true })
          head.use(TemplateParamsPlugin)
          head.push({ meta: [{ property: 'og:image', content: 'https://example.com/page.png' }, { name: 'twitter:card', content: 'summary' }] })
          head.push({ meta }, OG_META_MODES[mode] as any)
          return renderSSRHead(head)
        })()
        const html = render(head => compiled._tag === 'Compiled' && head.push(compiled.tags, { values: compiled.values }))(true)
        expect(html).toEqual(loose)
      })
    }
  }

  it('returns the same compiled tags for the same identities', () => {
    const a = compileOgMeta(shapes, 'plain', resolved('/a.png', { width: 1 }))
    const b = compileOgMeta(shapes, 'plain', resolved('/b.png', { width: 2 }))
    expect(a._tag === 'Compiled' && b._tag === 'Compiled' && a.tags === b.tags).toBe(true)
  })

  it('keeps normal input for content compiled tags render differently', () => {
    expect(compileOgMeta(shapes, 'plain', [{ property: 'og:image', content: '' }])._tag).toBe('Loose')
    expect(compileOgMeta(shapes, 'plain', [...resolved('/a.png', {}), ...resolved('/b.png', {})])._tag).toBe('Loose')
  })
})
