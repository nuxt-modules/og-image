import { createResolver } from '@nuxt/kit'
import { setup } from '@nuxt/test-utils/e2e'
import sharp from 'sharp'
import { expect, it } from 'vitest'
import { fetchOgImage } from '../utils'

const { resolve } = createResolver(import.meta.url)

await setup({
  rootDir: resolve('../fixtures/takumi-bundled-font'),
  build: true,
  server: true,
})

async function renderPixels(path: string) {
  return sharp(await fetchOgImage(path)).raw().toBuffer()
}

it('renders the font emitted with the UnoCSS stylesheet', async () => {
  const [barlow, fallback] = await Promise.all([renderPixels('/'), renderPixels('/fallback')])

  expect(barlow.equals(fallback), 'Barlow rendered the same pixels as the Inter fallback').toBe(false)
})
