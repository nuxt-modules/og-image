import { createResolver } from '@nuxt/kit'
import { setup } from '@nuxt/test-utils/e2e'
import sharp from 'sharp'
import { expect, it } from 'vitest'
import { fetchOgImages, setupImageSnapshots } from '../utils'

const { resolve } = createResolver(import.meta.url)

await setup({
  rootDir: resolve('../fixtures/takumi-bundled-font'),
  build: true,
  server: true,
})

setupImageSnapshots({ failureThreshold: 0.001, failureThresholdType: 'percent' })

it('renders the font emitted with the UnoCSS stylesheet', async () => {
  const images = await fetchOgImages('/', '/fallback')
  const barlow = images.get('/')!
  const fallback = images.get('/fallback')!
  const [barlowPixels, fallbackPixels] = await Promise.all([
    sharp(barlow).raw().toBuffer(),
    sharp(fallback).raw().toBuffer(),
  ])

  expect(barlow).toMatchImageSnapshot({ customSnapshotIdentifier: 'takumi-bundled-barlow' })
  expect(barlowPixels.equals(fallbackPixels), 'Barlow rendered the same pixels as the Inter fallback').toBe(false)
})
