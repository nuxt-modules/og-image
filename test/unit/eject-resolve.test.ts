import { describe, expect, it } from 'vitest'
import { detectAppRenderers, detectInstalledRenderers, resolveEjectTemplate } from '../../src/eject'

const templateFiles = ['NuxtSeo.satori.vue', 'NuxtSeo.takumi.vue', 'Brutalist.satori.vue', 'BlogPost.takumi.vue']
const none = { appRenderers: [], installedRenderers: [] }

describe('resolveEjectTemplate', () => {
  it('accepts a name with a renderer suffix', () => {
    expect(resolveEjectTemplate('NuxtSeo.takumi', { templateFiles, ...none }))
      .toMatchObject({ _tag: 'Ok', file: 'NuxtSeo.takumi.vue', reason: 'exact' })
    expect(resolveEjectTemplate('NuxtSeo.satori', { templateFiles, appRenderers: ['takumi'], installedRenderers: ['takumi'] }))
      .toMatchObject({ _tag: 'Ok', file: 'NuxtSeo.satori.vue' })
  })

  it('picks the renderer of the app templates for a bare name', () => {
    expect(resolveEjectTemplate('NuxtSeo', { templateFiles, appRenderers: ['satori'], installedRenderers: ['takumi'] }))
      .toMatchObject({ file: 'NuxtSeo.satori.vue', reason: 'app-templates' })
  })

  it('picks the installed renderer when the app has no templates', () => {
    expect(resolveEjectTemplate('NuxtSeo', { templateFiles, appRenderers: [], installedRenderers: ['takumi'] }))
      .toMatchObject({ file: 'NuxtSeo.takumi.vue', reason: 'installed' })
    expect(resolveEjectTemplate('NuxtSeo', { templateFiles, appRenderers: [], installedRenderers: ['satori'] }))
      .toMatchObject({ file: 'NuxtSeo.satori.vue', reason: 'installed' })
  })

  it('defaults to takumi when nothing is known', () => {
    expect(resolveEjectTemplate('NuxtSeo', { templateFiles, ...none }))
      .toMatchObject({ file: 'NuxtSeo.takumi.vue', reason: 'default' })
  })

  it('uses the only variant a template has', () => {
    expect(resolveEjectTemplate('Brutalist', { templateFiles, appRenderers: ['takumi'], installedRenderers: ['takumi'] }))
      .toMatchObject({ file: 'Brutalist.satori.vue', reason: 'only-variant' })
  })

  it('reports unknown names and suffixes with the accepted names', () => {
    const result = resolveEjectTemplate('BlogPost.satori', { templateFiles, ...none })
    expect(result._tag).toBe('NotFound')
    expect(result._tag === 'NotFound' && result.available).toContain('BlogPost.takumi')
  })
})

describe('renderer detection', () => {
  it('reads renderers from package.json dependencies', () => {
    expect(detectInstalledRenderers({ dependencies: { '@takumi-rs/wasm': '1' }, devDependencies: { satori: '1' } }))
      .toEqual(['takumi', 'satori'])
    expect(detectInstalledRenderers(null)).toEqual([])
  })

  it('reads renderers from template suffixes', () => {
    expect(detectAppRenderers(['/app/components/OgImage/Card.satori.vue', 'Plain.vue'])).toEqual(['satori'])
  })
})
