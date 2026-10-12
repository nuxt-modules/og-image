import type { SatoriNode } from 'satori'
import type { OgImageRenderEventContext } from '../../src/runtime/types'
import { readFile } from 'node:fs/promises'
import { resolveModulePath } from 'exsolve'
import satori from 'satori'
import standalone, { init } from 'satori/standalone'
import { describe, expect, it, vi } from 'vitest'
import { applyEmojis } from '../../src/runtime/server/og-image/core/transforms/emojis'
import { htmlToVNode } from '../../src/runtime/server/og-image/core/vnodes'

vi.mock('../../src/runtime/server/util/kit', () => ({}))
vi.mock('../../src/runtime/server/og-image/core/plugins/imageSrc', () => ({ default: [] }))
vi.mock('../../src/runtime/server/og-image/core/plugins/styleDirectives', () => ({ default: [] }))

vi.mock('#og-image/emoji-transform', () => ({
  getEmojiSvg: async () => '<svg width="1em" height="1em" viewBox="0 0 10 10" style="display:inline-block;vertical-align:middle"><path d="M0 0h10v10H0z"/></svg>',
}))

const font = await readFile(new URL('../fixtures/multi-font-families/public/fonts/LocalSans-Regular.ttf', import.meta.url))
const options = { width: 300, height: 150, fonts: [{ name: 'LocalSans', data: font }] }

describe('satori native rendering', () => {
  it('lays out inline text and dynamic emoji on one line', async () => {
    const content = { html: '<p style="font-size:24px">Hello 👋 World</p>' }
    await applyEmojis({ options: { emojis: 'noto' } } as OgImageRenderEventContext, content)
    const node = htmlToVNode(`<div>${content.html}</div>`)
    expect(node.props.style?.display).toBeUndefined()
    const boxes: SatoriNode[] = []
    const svg = await satori(node, { ...options, onNodeDetected: box => boxes.push(box) })
    expect(svg).toContain('<image')
    const inline = boxes.filter(box => box.type === 'svg')
    expect(inline[0]?.width).toBe(24)
    expect(inline[0]?.height).toBe(24)
  })

  it.each(['bundled', 'standalone'] as const)('renders block and grid layout with %s WASM', async (mode) => {
    if (mode === 'standalone')
      await init(await WebAssembly.compile(await readFile(resolveModulePath('satori/layout.wasm'))))
    const boxes: SatoriNode[] = []
    const render = mode === 'standalone' ? standalone : satori
    const svg = await render({
      type: 'div',
      props: {
        style: { display: 'grid', gridTemplateColumns: '50px 100px', gap: 10 },
        children: ['red', 'blue'].map(color => ({ type: 'div', props: { 'style': { height: 30, backgroundColor: color }, 'data-cell': color } })),
      },
    }, { ...options, onNodeDetected: box => boxes.push(box) })
    expect(svg).toContain('fill="red"')
    const cells = boxes.filter(box => box.props['data-cell'])
    expect(cells.map(box => [box.left, box.width])).toEqual([[0, 50], [60, 100]])
  })
})
