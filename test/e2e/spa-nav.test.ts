import { createResolver } from '@nuxt/kit'
import { createPage, setup, url } from '@nuxt/test-utils/e2e'
import { describe, expect, it } from 'vitest'

const { resolve } = createResolver(import.meta.url)

await setup({
  rootDir: resolve('../fixtures/basic'),
  server: true,
  build: true,
  browser: true,
})

/**
 * #567: on client-side SPA navigation the og:image meta tag must update to reflect
 * the current route. iOS share sheet, devtools and any other consumer that reads
 * meta tags from the live DOM would otherwise see the URL baked in during the
 * initial SSR render, regardless of which page the user actually navigated to.
 */
describe('sPA navigation og:image', () => {
  it.runIf(process.env.HAS_CHROME)('updates og:image when navigating between pages', async () => {
    // createPage's hydration wait looks for `window.useNuxtApp`, which isn't
    // exposed on prod SSR builds — use `networkidle` instead and a manual hydration
    // probe before clicking the NuxtLink.
    const page = await createPage(undefined)
    await page.goto(url('/satori/spa-nav-a'), { waitUntil: 'networkidle' })
    // Wait for Nuxt client bundle to load and attach listeners.
    await page.waitForTimeout(2000)

    const initialOgImage = await page.getAttribute('meta[property="og:image"]', 'content')
    expect(initialOgImage).toBeTruthy()
    // SSR emits the direct URL with the page's title encoded.
    expect(initialOgImage).toMatch(/title_Page\+A/)

    // SPA nav: on SSR deployments the client points at the /_og/r/ resolver so the
    // URL always matches whatever the server would emit for the target route.
    await Promise.all([
      page.waitForURL('**/satori/spa-nav-b'),
      page.click('#to-b'),
    ])
    await page.waitForFunction(
      () => document.querySelector('meta[property="og:image"]')?.getAttribute('content')?.includes('/_og/r/satori/spa-nav-b'),
      null,
      { timeout: 5000 },
    )

    const updatedOgImage = await page.getAttribute('meta[property="og:image"]', 'content')
    expect(updatedOgImage).not.toBe(initialOgImage)
    expect(updatedOgImage).toContain('/_og/r/satori/spa-nav-b')

    // Nav back to A to confirm updates are not one-way.
    await Promise.all([
      page.waitForURL('**/satori/spa-nav-a'),
      page.click('#to-a'),
    ])
    await page.waitForFunction(
      () => document.querySelector('meta[property="og:image"]')?.getAttribute('content')?.includes('/_og/r/satori/spa-nav-a'),
      null,
      { timeout: 5000 },
    )

    const backOgImage = await page.getAttribute('meta[property="og:image"]', 'content')
    expect(backOgImage).toContain('/_og/r/satori/spa-nav-a')

    await page.close()
  }, 60000)

  it.runIf(process.env.HAS_CHROME)('forwards query params through the resolver URL', async () => {
    const page = await createPage(undefined)
    await page.goto(url('/satori/spa-nav-a'), { waitUntil: 'networkidle' })
    // Wait for Nuxt client bundle to load and attach listeners.
    await page.waitForTimeout(2000)

    // Navigate via the `?lang=fr` variant link. The resolver URL emitted by the
    // client should carry the query through so variant-by-query pages get the
    // right og:image.
    await Promise.all([
      page.waitForURL('**/satori/spa-nav-b?lang=fr'),
      page.click('#to-b-lang-fr'),
    ])
    await page.waitForFunction(
      () => {
        const content = document.querySelector('meta[property="og:image"]')?.getAttribute('content') || ''
        return content.includes('/_og/r/satori/spa-nav-b') && content.includes('lang=fr')
      },
      null,
      { timeout: 5000 },
    )

    const ogImage = await page.getAttribute('meta[property="og:image"]', 'content')
    expect(ogImage).toContain('/_og/r/satori/spa-nav-b')
    expect(ogImage).toContain('lang=fr')

    await page.close()
  }, 60000)
})
