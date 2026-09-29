import { describe, expect, it } from 'vitest'
import { checkMissingRendererUsage, collectOgImageReferences } from '../../src/build/usage-check'

const components = [
  { pascalName: 'OgImageCardTakumi', category: 'app' as const, renderer: 'takumi' as const, path: '/app/components/OgImage/Card.takumi.vue' },
  { pascalName: 'OgImageStraySatori', category: 'app' as const, renderer: 'satori' as const, path: '/app/components/OgImage/Stray.satori.vue' },
  { pascalName: 'NuxtSeoSatori', category: 'community' as const, renderer: 'satori' as const, path: '/module/NuxtSeo.satori.vue' },
]
const missingRenderers = { satori: ['satori', '@resvg/resvg-js'] }

describe('checkMissingRendererUsage', () => {
  it('fails when a used template needs a missing renderer', () => {
    const { errors, warnings } = checkMissingRendererUsage({
      components,
      missingRenderers,
      references: collectOgImageReferences(`defineOgImage('Stray', { title: 'x' })`),
    })
    expect(errors).toHaveLength(1)
    expect(errors[0]).toContain('Stray.satori.vue')
    expect(errors[0]).toContain('npx nypm add satori @resvg/resvg-js')
    expect(warnings).toEqual([])
  })

  it('warns and keeps building when the template is not used', () => {
    const { errors, warnings } = checkMissingRendererUsage({
      components,
      missingRenderers,
      references: collectOgImageReferences(`defineOgImage('Card')`),
    })
    expect(errors).toEqual([])
    expect(warnings).toHaveLength(1)
    expect(warnings[0]).toContain('/app/components/OgImage/Stray.satori.vue')
    expect(warnings[0]).toContain('npx nypm add satori @resvg/resvg-js')
  })

  it('counts a route rule component as a use', () => {
    const { errors } = checkMissingRendererUsage({
      components,
      missingRenderers,
      references: { names: ['Stray'], hasDynamicName: false, usesDefault: false },
    })
    expect(errors).toHaveLength(1)
  })

  it('counts the default template when a route rule names no component', () => {
    const stray = [components[1]!, components[0]!]
    const { errors } = checkMissingRendererUsage({
      components: stray,
      missingRenderers,
      references: { names: [], hasDynamicName: false, usesDefault: true },
    })
    expect(errors).toHaveLength(1)
  })

  it('only warns when a component name is built at runtime', () => {
    const { errors, warnings } = checkMissingRendererUsage({
      components,
      missingRenderers,
      references: collectOgImageReferences(`defineOgImage(name, {})`),
    })
    expect(errors).toEqual([])
    expect(warnings).toHaveLength(1)
  })

  it('reports nothing when every renderer is installed', () => {
    expect(checkMissingRendererUsage({
      components,
      missingRenderers: {},
      references: collectOgImageReferences(`defineOgImage('Stray')`),
    })).toEqual({ errors: [], warnings: [] })
  })
})
