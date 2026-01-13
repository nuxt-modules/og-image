import { describe, expect, it } from 'vitest'
import binding from '../../src/runtime/server/og-image/bindings/resvg/node-dev'

const { Resvg } = binding

const simpleSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100">
  <rect width="100" height="100" fill="red"/>
</svg>`

describe('node-dev resvg binding', () => {
  it('renders simple svg to png', async () => {
    const resvg = new Resvg(simpleSvg)
    const png = await resvg.render().asPng()
    expect(png).toBeInstanceOf(Buffer)
    expect(png.length).toBeGreaterThan(0)
    // PNG magic bytes
    expect(png[0]).toBe(0x89)
    expect(png[1]).toBe(0x50) // P
    expect(png[2]).toBe(0x4E) // N
    expect(png[3]).toBe(0x47) // G
  })

  it('handles concurrent requests', async () => {
    const results = await Promise.all([
      new Resvg(simpleSvg).render().asPng(),
      new Resvg(simpleSvg).render().asPng(),
      new Resvg(simpleSvg).render().asPng(),
    ])
    for (const png of results) {
      expect(png).toBeInstanceOf(Buffer)
      expect(png[0]).toBe(0x89)
    }
  })

  it('rejects on invalid svg without crashing', async () => {
    const invalidSvg = `not valid svg`
    const resvg = new Resvg(invalidSvg)
    const error = await resvg.render().asPng().catch(e => e)
    expect(error).toBeInstanceOf(Error)
  })
})
