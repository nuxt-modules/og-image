import { describe, expect, it } from 'vitest'
import binding from '../../src/runtime/server/og-image/bindings/takumi/node-dev'

const Renderer = binding.Renderer as any

const node = {
  type: 'container',
  style: { display: 'flex', width: 200, height: 100, fontSize: 32 },
  children: [{ type: 'text', text: 'Hi' }],
}

function prepareOptions(overrides: Record<string, unknown> = {}) {
  return {
    width: 200,
    height: 100,
    devicePixelRatio: 1,
    fontFamilies: [],
    fonts: [],
    images: { sources: [], fetch: async () => { throw new Error('unreachable') }, allowUrl: () => false },
    ...overrides,
  }
}

describe('node-dev takumi binding', () => {
  it('renders with an abort signal, which cannot cross the worker boundary', async () => {
    const renderer = new Renderer()
    const prepared = await renderer.prepare(node, prepareOptions({ signal: AbortSignal.timeout(10_000) }))
    const png = await renderer.render(prepared, { format: 'png', signal: AbortSignal.timeout(10_000) })
    expect(png.subarray(1, 4).toString()).toBe('PNG')
  })

  it('renders without a font that fails to load', async () => {
    const renderer = new Renderer()
    const fonts = [{ key: 'missing', name: 'Missing', data: async () => { throw new Error('404') } }]
    const png = await renderer.render(await renderer.prepare(node, prepareOptions({ fonts })), { format: 'png' })
    expect(png.subarray(1, 4).toString()).toBe('PNG')
  })

  it('serves concurrent renders', async () => {
    const renderer = new Renderer()
    const results = await Promise.all([1, 2, 3].map(async () => renderer.render(await renderer.prepare(node, prepareOptions()), { format: 'png' })))
    for (const png of results) {
      expect(png.subarray(1, 4).toString()).toBe('PNG')
    }
  })
})
