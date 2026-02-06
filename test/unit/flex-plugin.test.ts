import { describe, expect, it } from 'vitest'

// Inline the flex plugin logic for unit testing (avoids runtime import aliases)
const INLINE_ELEMENTS = ['span', 'a', 'b', 'i', 'u', 'em', 'strong', 'code', 'abbr', 'del', 'ins', 'mark', 'sub', 'sup', 'small', 'p', 'h1', 'h2', 'h3', 'h4', 'h5']

interface VNode {
  type: string
  props: {
    style?: Record<string, any>
    class?: string
    children?: (VNode | string)[]
    [key: string]: any
  }
}

function flexFilter(node: VNode): boolean {
  return [...INLINE_ELEMENTS, 'div'].includes(node.type)
    && (Array.isArray(node.props?.children) && node.props?.children.length >= 1)
    && (!node.props?.class?.includes('hidden'))
}

// Matches simplified flex plugin: only handles elements without display set
function flexTransform(node: VNode): void {
  node.props.style = node.props.style || {}
  if (node.props.style.display)
    return

  if (node.type === 'div') {
    node.props.style.display = 'flex'
    if (!node.props.style.flexDirection && !/\bflex\b/.test(node.props?.class || ''))
      node.props.style.flexDirection = 'column'
    return
  }

  node.props.style.display = 'flex'
  if (!node.props.style.flexWrap)
    node.props.style.flexWrap = 'wrap'
  if (node.props.style.flexWrap === 'wrap' && !node.props.style.gap)
    node.props.style.gap = '0.2em'
}

function applyFlex(node: VNode): VNode {
  if (flexFilter(node))
    flexTransform(node)
  return node
}

describe('flex plugin (runtime)', () => {
  describe('bare divs — no display set', () => {
    it('adds flex + column to bare div', () => {
      const node: VNode = {
        type: 'div',
        props: { children: [{ type: 'div', props: {} }] },
      }
      applyFlex(node)
      expect(node.props.style).toMatchObject({ display: 'flex', flexDirection: 'column' })
    })

    it('adds flex + column to div with non-display styles', () => {
      const node: VNode = {
        type: 'div',
        props: {
          style: { width: '100%', padding: '1rem' },
          children: [{ type: 'span', props: { children: ['text'] } }],
        },
      }
      applyFlex(node)
      expect(node.props.style).toMatchObject({ display: 'flex', flexDirection: 'column' })
    })
  })

  describe('build-time handled — display already set', () => {
    it('skips div with display:flex (build-time resolved `flex` class)', () => {
      // Simulates: <div class="flex items-center gap-3"> after build-time
      const node: VNode = {
        type: 'div',
        props: {
          style: { display: 'flex', flexDirection: 'row', alignItems: 'center', gap: '0.75rem' },
          children: [
            { type: 'div', props: {} },
            { type: 'p', props: { children: ['text'] } },
          ],
        },
      }
      applyFlex(node)
      expect(node.props.style?.flexDirection).toBe('row')
    })

    it('skips div with display:flex + column (build-time resolved `flex flex-col`)', () => {
      const node: VNode = {
        type: 'div',
        props: {
          style: { display: 'flex', flexDirection: 'column', justifyContent: 'space-between' },
          children: [
            { type: 'h1', props: { children: ['title'] } },
            { type: 'div', props: {} },
          ],
        },
      }
      applyFlex(node)
      expect(node.props.style?.flexDirection).toBe('column')
    })

    it('skips div with display:block', () => {
      const node: VNode = {
        type: 'div',
        props: {
          style: { display: 'block' },
          children: [{ type: 'div', props: {} }],
        },
      }
      applyFlex(node)
      expect(node.props.style?.display).toBe('block')
      expect(node.props.style?.flexDirection).toBeUndefined()
    })
  })

  describe('inline elements', () => {
    it('adds flex + wrap to bare span', () => {
      const node: VNode = {
        type: 'span',
        props: { children: ['text'] },
      }
      applyFlex(node)
      expect(node.props.style).toMatchObject({ display: 'flex', flexWrap: 'wrap', gap: '0.2em' })
    })

    it('skips span with display already set', () => {
      const node: VNode = {
        type: 'span',
        props: {
          style: { display: 'flex', flexWrap: 'nowrap' },
          children: ['text'],
        },
      }
      applyFlex(node)
      expect(node.props.style?.flexWrap).toBe('nowrap')
    })

    it('respects existing flexWrap and gap', () => {
      const node: VNode = {
        type: 'h1',
        props: {
          style: { gap: '1rem' },
          children: ['title'],
        },
      }
      applyFlex(node)
      expect(node.props.style?.flexWrap).toBe('wrap')
      expect(node.props.style?.gap).toBe('1rem')
    })
  })

  describe('template regressions', () => {
    it('simpleBlog: bottom bar stays row after build-time', () => {
      // <div class="flex items-center gap-3"> → build-time emits display:flex + flex-direction:row
      const node: VNode = {
        type: 'div',
        props: {
          style: { display: 'flex', flexDirection: 'row', alignItems: 'center', gap: '0.75rem' },
          children: [
            { type: 'div', props: { style: { width: '0.75rem', height: '0.75rem' } } },
            { type: 'p', props: { children: ['nuxtseo.com'] } },
          ],
        },
      }
      applyFlex(node)
      expect(node.props.style?.flexDirection).toBe('row')
    })

    it('saaS: browser chrome bar stays row after build-time', () => {
      // <div class="flex flex-row items-center"> → build-time emits display:flex + flex-direction:row
      const node: VNode = {
        type: 'div',
        props: {
          style: { display: 'flex', flexDirection: 'row', alignItems: 'center' },
          children: [
            { type: 'div', props: {} },
            { type: 'div', props: {} },
            { type: 'div', props: {} },
          ],
        },
      }
      applyFlex(node)
      expect(node.props.style?.flexDirection).toBe('row')
    })

    it('nuxtSeo: wrapper div without flex class gets column', () => {
      // <div class="w-full h-full justify-center items-center ..."> (no flex class)
      // Build-time resolves sizing/alignment but NOT display:flex
      // Runtime adds flex + column
      const node: VNode = {
        type: 'div',
        props: {
          style: { width: '100%', height: '100%', justifyContent: 'center', alignItems: 'center' },
          children: [
            { type: 'div', props: {} },
            { type: 'div', props: {} },
          ],
        },
      }
      applyFlex(node)
      expect(node.props.style).toMatchObject({ display: 'flex', flexDirection: 'column' })
    })
  })

  describe('runtime — build-time did NOT run (classes still in class attr)', () => {
    it('combinedTest: flex gap-2 stays row when flex is in class', () => {
      // <div class="flex gap-2"> with span children — build-time didn't resolve
      // twClasses moved gap to style, flex stays in class/tw
      const node: VNode = {
        type: 'div',
        props: {
          class: 'flex',
          style: { gap: 2 },
          children: [
            { type: 'span', props: { style: { display: 'flex' }, children: ['icon'] } },
            { type: 'span', props: { style: { display: 'flex' }, children: ['icon'] } },
          ],
        },
      }
      applyFlex(node)
      expect(node.props.style?.display).toBe('flex')
      expect(node.props.style?.flexDirection).toBeUndefined()
    })

    it('flex items-center stays row when flex is in class', () => {
      // <div class="flex items-center text-white"> — build-time didn't resolve
      const node: VNode = {
        type: 'div',
        props: {
          class: 'flex items-center text-white',
          style: { gap: 8 },
          children: [
            { type: 'img', props: {} },
            { type: 'div', props: { class: 'flex flex-col' } },
          ],
        },
      }
      applyFlex(node)
      expect(node.props.style?.display).toBe('flex')
      expect(node.props.style?.flexDirection).toBeUndefined()
    })

    it('flex flex-col lets Satori tw handle direction', () => {
      // <div class="flex flex-col"> — flex in class, flex-col handled by tw
      const node: VNode = {
        type: 'div',
        props: {
          class: 'flex flex-col',
          style: { gap: 2 },
          children: [
            { type: 'h1', props: { children: ['title'] } },
            { type: 'div', props: {} },
          ],
        },
      }
      applyFlex(node)
      expect(node.props.style?.display).toBe('flex')
      // Plugin doesn't set column — Satori handles flex-col via tw prop
      expect(node.props.style?.flexDirection).toBeUndefined()
    })

    it('div without flex class still gets column', () => {
      // <div class="w-full h-full justify-center items-center"> — no flex class
      const node: VNode = {
        type: 'div',
        props: {
          class: 'w-full h-full justify-center items-center',
          children: [
            { type: 'div', props: {} },
          ],
        },
      }
      applyFlex(node)
      expect(node.props.style).toMatchObject({ display: 'flex', flexDirection: 'column' })
    })
  })
})
