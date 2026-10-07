import type { VNode } from '../../src/runtime/types'
import { describe, expect, it, vi } from 'vitest'
import { vnodeToTakumiNode } from '../../src/runtime/server/og-image/takumi/nodes'

vi.mock('#og-image/emoji-transform', () => ({ getEmojiSvg: async () => null }))
vi.mock('#nuxtseo/nitro', () => ({ useNitroApp: () => ({}), useRuntimeConfig: () => ({}), useStorage: () => ({}), fetchWithEvent: () => null }))
vi.mock('#nuxtseo/h3', () => ({ createError: (e: unknown) => e }))
vi.mock('#og-image/island-hash', () => ({ getIslandHash: () => '' }))
vi.mock('#og-image-virtual/tw4-theme.mjs', () => ({ tw4Breakpoints: {} }))
vi.mock('#site-config/server/composables/getNitroOrigin', () => ({ getNitroOrigin: () => '' }))
vi.mock('#site-config/server/composables', () => ({ getNitroOrigin: () => '' }))

function emoji(): VNode {
  return { type: 'svg', props: { xmlns: 'http://www.w3.org/2000/svg', viewBox: '0 0 128 128', width: '1em', height: '1em', children: [] } } as VNode
}

function heading(cls: string): VNode {
  return { type: 'h1', props: { class: cls, children: ['Ship it ', emoji(), ' now'] } } as VNode
}

describe('takumi inline svg', () => {
  it('sizes an em svg by the font size Takumi computes, including Tailwind classes', async () => {
    const node = await vnodeToTakumiNode(heading('text-8xl font-bold')) as any
    const image = node.children.find((c: any) => c.type === 'image')
    expect(image.style).toMatchObject({ width: '1em', height: '1em' })
    expect(image.width).toBeUndefined()
    expect(image.height).toBeUndefined()
  })

  it('keeps the spaces between text and an inline emoji', async () => {
    const node = await vnodeToTakumiNode(heading('text-[40px]')) as any
    expect(node.children.map((c: any) => c.text ?? c.type)).toEqual(['Ship it ', 'image', ' now'])
  })
})
