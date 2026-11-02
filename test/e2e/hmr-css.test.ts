import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { createResolver } from '@nuxt/kit'
import { setup } from '@nuxt/test-utils/e2e'
import { afterAll, describe, expect, it } from 'vitest'
import { fetchOgHtml, waitFor } from '../utils'

const { resolve } = createResolver(import.meta.url)

const fixtureRoot = resolve('../fixtures/tailwind')
const cssFile = join(fixtureRoot, 'assets/css/main.css')

let originalCss: string | undefined

describe.skipIf(!import.meta.env?.TEST_DEV)('hmr css', async () => {
  await setup({
    rootDir: fixtureRoot,
    dev: true,
  })

  afterAll(() => {
    if (originalCss !== undefined)
      writeFileSync(cssFile, originalCss, 'utf-8')
  })

  it('initial render has green bg from @theme vars', async () => {
    const preview = await fetchOgHtml('/')
    expect(preview).toBeTruthy()
    expect(preview).toContain('Hello World')
    // bg-primary-500 (#22c55e) should be resolved to inline style
    expect(preview).toMatch(/background-color:\s*#22c55e/)
  }, 60000)

  it('cSS @theme var change is reflected without touching the component', async () => {
    originalCss = readFileSync(cssFile, 'utf-8')

    // Change primary-500 from green (#22c55e) to red (#ef4444)
    const modifiedCss = originalCss.replace(
      '--color-primary-500: #22c55e;',
      '--color-primary-500: #ef4444;',
    )
    expect(modifiedCss).not.toBe(originalCss)
    writeFileSync(cssFile, modifiedCss, 'utf-8')

    // The transform declares the CSS file as a watch file, so the edit alone re-transforms the component
    await waitFor(async () => {
      const preview = await fetchOgHtml('/')
      if (!preview)
        return false
      return preview.includes('#ef4444')
    }, { timeout: 20000 })

    const preview = await fetchOgHtml('/')
    expect(preview).toMatch(/background-color:\s*#ef4444/)
    expect(preview).not.toMatch(/background-color:\s*#22c55e/)
  }, 30000)
})
