import { Resvg } from '@resvg/resvg-js'
import satori from 'satori'
import { describe, expect, it } from 'vitest'
import { resolveSvgFilters } from '../../src/runtime/server/og-image/satori/filters'

describe('satori SVG filters', () => {
  it.each(['saturate(0.5)', 'saturate(1)', 'saturate(1.5)', 'saturate(2)', 'saturate(3)', 'brightness(0.8) saturate(2)'])('preserves %s in Resvg', async (filter) => {
    const svg = await satori({
      type: 'div',
      props: { style: { width: 10, height: 10, backgroundColor: '#f29101', filter } },
    }, { width: 10, height: 10, fonts: [] })
    const actual = new Resvg(resolveSvgFilters(svg)).render().pixels
    const reference = new Resvg(`<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><rect width="10" height="10" fill="#f29101" filter="${filter}"/></svg>`).render().pixels

    for (let channel = 0; channel < 4; channel++)
      expect(Math.abs(actual[channel]! - reference[channel]!)).toBeLessThanOrEqual(1)
  })
})
