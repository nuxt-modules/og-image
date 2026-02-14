import { describe, expect, it } from 'vitest'
import encoding from '../../src/runtime/server/og-image/core/plugins/encoding'
import { decodeHtml } from '../../src/runtime/server/util/encoding'

describe('encoding', () => {
  describe('decodeHtml', () => {
    it('decodes common html entities', () => {
      expect(decodeHtml('&lt;test&gt;')).toBe('<test>')
      expect(decodeHtml('&amp;')).toBe('&')
      expect(decodeHtml('&quot;')).toBe('"')
      expect(decodeHtml('&#39;')).toBe('\'')
    })

    it('decodes numeric entities', () => {
      expect(decodeHtml('&#60;')).toBe('<')
      expect(decodeHtml('&#62;')).toBe('>')
    })
  })

  describe('encoding plugin - text with siblings', () => {
    const [_inspectorTransform, stringTransform, arrayTransform] = encoding

    it('decodes string children', () => {
      const node = { props: { children: '&lt;test&gt;' } }
      expect(stringTransform.filter(node)).toBe(true)
      stringTransform.transform(node, {} as any)
      expect(node.props.children).toBe('<test>')
    })

    it('decodes strings in array children (text with siblings)', () => {
      const node = {
        props: {
          children: [
            '&lt;a&gt;',
            { type: 'p', props: { children: 'elem' } },
            '&lt;b&gt;',
          ],
        },
      }
      expect(arrayTransform.filter(node)).toBe(true)
      arrayTransform.transform(node, {} as any)
      expect(node.props.children).toEqual([
        '<a>',
        { type: 'p', props: { children: 'elem' } },
        '<b>',
      ])
    })

    it('handles array with null (comments become null)', () => {
      const node = {
        props: {
          children: [null, '&lt;test&gt;'],
        },
      }
      expect(arrayTransform.filter(node)).toBe(true)
      arrayTransform.transform(node, {} as any)
      expect(node.props.children).toEqual([null, '<test>'])
    })

    it('handles array with only VNodes (no text)', () => {
      const node = {
        props: {
          children: [
            { type: 'p', props: { children: 'a' } },
            { type: 'p', props: { children: 'b' } },
          ],
        },
      }
      expect(arrayTransform.filter(node)).toBe(true)
      arrayTransform.transform(node, {} as any)
      // Should not throw, VNodes unchanged
      expect(node.props.children).toEqual([
        { type: 'p', props: { children: 'a' } },
        { type: 'p', props: { children: 'b' } },
      ])
    })
  })
})
