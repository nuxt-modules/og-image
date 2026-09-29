import { describe, expect, it } from 'vitest'
import { findOgImageUsageErrors } from '../../src/build/usage-check'

const community = [
  { pascalName: 'NuxtSeoSatori', category: 'community' as const, renderer: 'satori' as const },
  { pascalName: 'NuxtSeoTakumi', category: 'community' as const, renderer: 'takumi' as const },
  { pascalName: 'BlogPostTakumi', category: 'community' as const, renderer: 'takumi' as const },
]
const app = [
  { pascalName: 'OgImageCardTakumi', category: 'app' as const, renderer: 'takumi' as const },
]

describe('findOgImageUsageErrors', () => {
  it('reports a community template that is not ejected', () => {
    const errors = findOgImageUsageErrors(`defineOgImage('NuxtSeo', { title: 'x' })`, { components: [...app, ...community], browserEnabled: false })
    expect(errors).toHaveLength(1)
    expect(errors[0]).toContain('npx nuxt-og-image eject NuxtSeo')
  })

  it('reports every call shape, including a renderer suffix and the deprecated composable', () => {
    const code = [
      `const paths = defineOgImage("BlogPost.takumi")`,
      `defineOgImageComponent('NuxtSeo')`,
    ].join('\n')
    expect(findOgImageUsageErrors(code, { components: [...app, ...community], browserEnabled: false })).toHaveLength(2)
  })

  it('accepts an ejected template with the same name', () => {
    const ejected = [...community, { pascalName: 'OgImageNuxtSeoTakumi', category: 'app' as const, renderer: 'takumi' as const }]
    expect(findOgImageUsageErrors(`defineOgImage('NuxtSeo')`, { components: ejected, browserEnabled: false })).toEqual([])
  })

  it('accepts app templates and dynamic names', () => {
    const code = `defineOgImage('Card')\ndefineOgImage(name, {})`
    expect(findOgImageUsageErrors(code, { components: [...app, ...community], browserEnabled: false })).toEqual([])
  })

  it('ignores calls inside strings and comments', () => {
    const code = `// defineOgImage('NuxtSeo')\nconst doc = "defineOgImageScreenshot()"`
    expect(findOgImageUsageErrors(code, { components: community, browserEnabled: false })).toEqual([])
  })

  it('reports defineOgImageScreenshot() when the browser renderer is off', () => {
    const errors = findOgImageUsageErrors(`defineOgImageScreenshot({ delay: 100 })`, { components: app, browserEnabled: false })
    expect(errors).toHaveLength(1)
    expect(errors[0]).toContain('ogImage.browser')
  })

  it('accepts defineOgImageScreenshot() when the browser renderer is on', () => {
    expect(findOgImageUsageErrors(`defineOgImageScreenshot()`, { components: app, browserEnabled: true })).toEqual([])
  })
})
