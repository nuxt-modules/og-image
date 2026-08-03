import { describe, expect, it } from 'vitest'
import TakumiBinding from '../../src/runtime/server/og-image/bindings/takumi/node-dev'

const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A])
const renderOptions = { width: 120, height: 60, format: 'png' as const }

function node(label: string) {
  return {
    type: 'container',
    style: { width: '120px', height: '60px', backgroundColor: '#0b1021' },
    children: [{ type: 'text', text: label, style: { color: 'white', fontSize: '18px' } }],
  }
}

describe('takumi node-dev worker binding', () => {
  it('drains concurrent renders', async () => {
    const renderer = new TakumiBinding.Renderer()
    const results = await Promise.all([
      renderer.render(node('one') as any, renderOptions),
      renderer.render(node('two') as any, renderOptions),
      renderer.render(node('three') as any, renderOptions),
    ])

    for (const png of results)
      expect(Buffer.from(png).subarray(0, 8).equals(PNG_MAGIC)).toBe(true)
  })

  it('rejects an undispatchable render without stalling its queued neighbour', async () => {
    const renderer = new TakumiBinding.Renderer()
    const settled = await Promise.allSettled([
      renderer.render({ ...node('bad'), undispatchable: () => undefined } as any, renderOptions),
      renderer.render(node('good') as any, renderOptions),
    ])

    expect(settled.map(result => result.status)).toEqual(['rejected', 'fulfilled'])
  })

  it('contains a render failure to its job', async () => {
    const renderer = new TakumiBinding.Renderer()
    const settled = await Promise.allSettled([
      renderer.render(node('before') as any, renderOptions),
      renderer.render(null as any, renderOptions),
      renderer.render(node('after') as any, renderOptions),
    ])

    expect(settled.map(result => result.status)).toEqual(['fulfilled', 'rejected', 'fulfilled'])
  })
})
