import { describe, expect, it } from 'vitest'
import ResvgBinding from '../../src/runtime/server/og-image/bindings/resvg/node-dev'

// Exercises the worker-backed resvg binding through its public surface.
// Concurrent prerendering fires many renders at once, so the binding must
// drain a deep queue without dropping, deadlocking, or cross-failing jobs.

const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A])

function svgRect(label: number) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="60" height="30"><rect width="60" height="30" fill="#00${(label % 90 + 10).toString()}0ff"/></svg>`
}

async function render(svg: string): Promise<Buffer> {
  const { Resvg } = ResvgBinding
  const instance = new Resvg(svg) as any
  return await instance.render().asPng()
}

describe('resvg node-dev worker binding', () => {
  it('drains a deep queue of concurrent renders', async () => {
    const results = await Promise.all(
      Array.from({ length: 24 }, (_, i) => render(svgRect(i))),
    )

    expect(results).toHaveLength(24)
    for (const png of results) {
      expect(Buffer.isBuffer(png)).toBe(true)
      expect(png.subarray(0, 8).equals(PNG_MAGIC)).toBe(true)
    }
  })

  it('fails an invalid job without failing its queued neighbours', async () => {
    const settled = await Promise.allSettled([
      render(svgRect(1)),
      render('this is not svg'),
      render(svgRect(2)),
      render('<svg>also broken'),
      render(svgRect(3)),
    ])

    expect(settled.map(r => r.status)).toEqual([
      'fulfilled',
      'rejected',
      'fulfilled',
      'rejected',
      'fulfilled',
    ])
  })
})
