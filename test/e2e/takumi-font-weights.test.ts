import { createResolver } from '@nuxt/kit'
import { setup } from '@nuxt/test-utils/e2e'
import sharp from 'sharp'
import { describe, expect, it } from 'vitest'
import { fetchOgImages } from '../utils'

const { resolve } = createResolver(import.meta.url)

await setup({
  rootDir: resolve('../fixtures/takumi-font-weights'),
  server: true,
  build: true,
})

/** Count the dark pixels of a render and measure how wide its text runs. */
async function measureText(image: Buffer): Promise<{ ink: number, width: number }> {
  const { data, info } = await sharp(image).greyscale().raw().toBuffer({ resolveWithObject: true })
  let ink = 0
  let left = info.width
  let right = 0
  for (let index = 0; index < data.length; index++) {
    if (data[index]! >= 128)
      continue
    ink++
    const x = index % info.width
    left = Math.min(left, x)
    right = Math.max(right, x)
  }
  return { ink, width: right - left }
}

// The fixture renders with Takumi's WASM build, which rejects WOFF font files.
describe('takumi wasm font weights', () => {
  it('renders a Google font at its regular and bold weights', async () => {
    const images = await fetchOgImages('/regular', '/bold', '/inter')
    const [regular, bold, inter] = await Promise.all(
      ['/regular', '/bold', '/inter'].map(path => measureText(images.get(path)!)),
    )
    // Poppins sets the same text wider than the bundled Inter fallback.
    expect(regular.width - inter.width).toBeGreaterThan(20)
    // Poppins Bold is wider than Poppins Regular. A synthesized bold keeps the regular width.
    expect(bold.width - regular.width).toBeGreaterThan(20)
    expect(bold.ink).toBeGreaterThan(regular.ink * 1.5)
  }, 120_000)
})
