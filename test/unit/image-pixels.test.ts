import sharp from 'sharp'
import { describe, expect, it } from 'vitest'
import { getImagePixels, imageHasColor } from '../utils'

describe('image pixel utilities', () => {
  it('reads opaque pixels and ignores transparent colors', async () => {
    const rgba = Buffer.from([255, 0, 0, 255, 0, 0, 255, 0])
    const image = await sharp(rgba, {
      raw: { width: 2, height: 1, channels: 4 },
    }).png().toBuffer()

    expect(await getImagePixels(image)).toEqual(rgba)
    expect(await imageHasColor(image, ({ r, g, b }) => r === 255 && g === 0 && b === 0)).toBe(true)
    expect(await imageHasColor(image, ({ r, g, b }) => r === 0 && g === 0 && b === 255)).toBe(false)
  })
})
