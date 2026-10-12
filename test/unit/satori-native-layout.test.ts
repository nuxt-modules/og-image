import type { ElementNode } from 'ultrahtml'
import type { OgImageRenderEventContext, VNode } from '../../src/runtime/types'
import { parse } from 'ultrahtml'
import { querySelector } from 'ultrahtml/selector'
import { describe, expect, it } from 'vitest'
import { postProcessStyles } from '../../src/build/css/css-utils'
import { AssetTransformPlugin } from '../../src/build/vite-asset-transform'
import { walkTree } from '../../src/runtime/server/og-image/core/plugins'
import { parseStyleAttr } from '../../src/runtime/server/og-image/core/style-attr'
import classes from '../../src/runtime/server/og-image/satori/plugins/classes'
import { runTransform } from '../unplugin'

describe('native Satori styles', () => {
  it.each(['inline', 'inline-block', 'block', 'grid'])('preserves display:%s', (display) => {
    const node = { type: 'span', props: { class: 'text-red-500', style: { display }, children: 'hello' } } as VNode
    walkTree({} as OgImageRenderEventContext, node, [classes])
    expect(node.props.style?.display).toBe(display)
  })

  it('preserves individual transforms and their composition order', async () => {
    const styles = { translate: '10% 20px', rotate: '30deg', scale: '2 3', transform: 'skewX(10deg)' }
    expect(await postProcessStyles(styles, new Map())).toEqual(styles)
  })
})

it('keeps stacking and backdrop utilities during the build transform', async () => {
  const plugin = AssetTransformPlugin.raw({
    ogComponentPaths: ['/app/components/OgImage'],
    rootDir: '/app',
    srcDir: '/app',
    publicDir: '/app/public',
    cssProvider: {
      name: 'tailwind',
      resolveClassesToStyles: async classes => Object.fromEntries(classes.map(cls => [cls, cls === 'z-10' ? { 'z-index': '10' } : { 'backdrop-filter': 'blur(8px)' }])),
    },
  }, { framework: 'vite' })
  const result = await runTransform(plugin, '<template><div class="z-10 backdrop-blur" /></template>', '/app/components/OgImage/Card.satori.vue')
  const node = querySelector(parse(result!.code), 'div') as ElementNode
  expect(parseStyleAttr(node.attributes.style)).toEqual({ zIndex: '10', backdropFilter: 'blur(8px)' })
})

it('preserves native inset shorthand', async () => {
  expect(await postProcessStyles({ inset: '10% 20px' }, new Map())).toEqual({ inset: '10% 20px' })
})
