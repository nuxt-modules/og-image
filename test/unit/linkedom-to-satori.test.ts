import type { ElementNode, TextNode } from 'ultrahtml'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'pathe'
import satori from 'satori'
import { ELEMENT_NODE, parse, TEXT_NODE } from 'ultrahtml'
import { querySelector } from 'ultrahtml/selector'
import { describe, expect, it } from 'vitest'

const __dirname = dirname(fileURLToPath(import.meta.url))

// Load a font for satori tests - find noto-sans from @vercel/og
function loadFont() {
  const fontPath = join(__dirname, '../../node_modules/.pnpm/@vercel+og@0.8.6/node_modules/@vercel/og/dist/noto-sans-v27-latin-regular.ttf')
  try {
    return readFileSync(fontPath)
  }
  catch {
    // Font not available, tests will be skipped
    return null
  }
}

const fontData = loadFont()
const fonts = fontData
  ? [{ name: 'Noto Sans', data: fontData, weight: 400 as const, style: 'normal' as const }]
  : []

const hasFonts = fonts.length > 0

/**
 * VNode structure expected by Satori:
 * {
 *   type: string,              // element name like 'div', 'span', 'img'
 *   props: {
 *     style?: Record<string, any>,  // camelCased CSS properties
 *     tw?: string,                   // Tailwind classes
 *     children?: (VNode | string)[],
 *     ...otherAttributes
 *   }
 * }
 */
interface SatoriVNode {
  type: string
  props: {
    style?: Record<string, any>
    tw?: string
    children?: (SatoriVNode | string)[]
    [key: string]: any
  }
}

function camelCase(str: string): string {
  return str.replace(/-([a-z])/g, (_, c) => c.toUpperCase())
}

function parseStyleAttr(style: string | null | undefined): Record<string, any> | undefined {
  if (!style)
    return undefined
  const result: Record<string, any> = {}
  for (const decl of style.split(';')) {
    const colonIdx = decl.indexOf(':')
    if (colonIdx === -1)
      continue
    const prop = decl.slice(0, colonIdx).trim()
    const val = decl.slice(colonIdx + 1).trim()
    if (prop && val)
      result[camelCase(prop)] = val
  }
  return Object.keys(result).length ? result : undefined
}

function elementToVNode(el: ElementNode): SatoriVNode {
  const props: SatoriVNode['props'] = {}

  const { style, class: cls, ...attrs } = el.attributes
  const parsedStyle = parseStyleAttr(style)
  if (parsedStyle)
    props.style = parsedStyle

  if (cls)
    props.tw = cls

  for (const [name, value] of Object.entries(attrs))
    props[name] = value

  const children: (SatoriVNode | string)[] = []
  for (const child of el.children) {
    if (child.type === ELEMENT_NODE) {
      children.push(elementToVNode(child as ElementNode))
    }
    else if (child.type === TEXT_NODE) {
      const text = (child as TextNode).value
      if (text.trim())
        children.push(text)
    }
  }

  if (children.length)
    props.children = children

  return { type: el.name, props }
}

describe('html to satori vnode', () => {
  describe('camelCase', () => {
    it('converts kebab-case to camelCase', () => {
      expect(camelCase('font-size')).toBe('fontSize')
      expect(camelCase('background-color')).toBe('backgroundColor')
      expect(camelCase('border-top-left-radius')).toBe('borderTopLeftRadius')
    })

    it('handles already camelCase', () => {
      expect(camelCase('fontSize')).toBe('fontSize')
    })

    it('handles single word', () => {
      expect(camelCase('color')).toBe('color')
    })
  })

  describe('parseStyleAttr', () => {
    it('parses simple styles', () => {
      expect(parseStyleAttr('color: red')).toEqual({ color: 'red' })
      expect(parseStyleAttr('font-size: 16px')).toEqual({ fontSize: '16px' })
    })

    it('parses multiple declarations', () => {
      expect(parseStyleAttr('color: red; font-size: 16px')).toEqual({
        color: 'red',
        fontSize: '16px',
      })
    })

    it('handles url() with colons', () => {
      expect(parseStyleAttr('background-image: url(https://example.com/img.png)')).toEqual({
        backgroundImage: 'url(https://example.com/img.png)',
      })
    })

    it('handles multiple colons in value', () => {
      expect(parseStyleAttr('content: "a:b:c"')).toEqual({
        content: '"a:b:c"',
      })
    })

    it('returns undefined for empty/null', () => {
      expect(parseStyleAttr(null)).toBeUndefined()
      expect(parseStyleAttr('')).toBeUndefined()
    })

    it('handles trailing semicolon', () => {
      expect(parseStyleAttr('color: red;')).toEqual({ color: 'red' })
    })
  })

  describe('elementToVNode', () => {
    it('converts basic element', () => {
      const doc = parse('<div></div>')
      const div = querySelector(doc, 'div') as ElementNode
      const vnode = elementToVNode(div)

      expect(vnode.type).toBe('div')
      expect(vnode.props.children).toBeUndefined()
    })

    it('converts element with style', () => {
      const doc = parse('<div style="color: red; font-size: 16px"></div>')
      const div = querySelector(doc, 'div') as ElementNode
      const vnode = elementToVNode(div)

      expect(vnode.type).toBe('div')
      expect(vnode.props.style).toEqual({
        color: 'red',
        fontSize: '16px',
      })
    })

    it('converts class to tw', () => {
      const doc = parse('<div class="flex items-center"></div>')
      const div = querySelector(doc, 'div') as ElementNode
      const vnode = elementToVNode(div)

      expect(vnode.props.tw).toBe('flex items-center')
    })

    it('preserves other attributes', () => {
      const doc = parse('<img src="test.png" alt="Test" />')
      const img = querySelector(doc, 'img') as ElementNode
      const vnode = elementToVNode(img)

      expect(vnode.type).toBe('img')
      expect(vnode.props.src).toBe('test.png')
      expect(vnode.props.alt).toBe('Test')
    })

    it('handles text content', () => {
      const doc = parse('<span>Hello World</span>')
      const span = querySelector(doc, 'span') as ElementNode
      const vnode = elementToVNode(span)

      expect(vnode.type).toBe('span')
      expect(vnode.props.children).toEqual(['Hello World'])
    })

    it('handles nested elements', () => {
      const doc = parse('<div><span>Text</span></div>')
      const div = querySelector(doc, 'div') as ElementNode
      const vnode = elementToVNode(div)

      expect(vnode.type).toBe('div')
      expect(vnode.props.children).toHaveLength(1)
      expect((vnode.props.children![0] as SatoriVNode).type).toBe('span')
      expect((vnode.props.children![0] as SatoriVNode).props.children).toEqual(['Text'])
    })

    it('handles mixed content (text + elements)', () => {
      const doc = parse('<div>Before <span>inner</span> After</div>')
      const div = querySelector(doc, 'div') as ElementNode
      const vnode = elementToVNode(div)

      expect(vnode.props.children).toHaveLength(3)
      expect(vnode.props.children![0]).toBe('Before ')
      expect((vnode.props.children![1] as SatoriVNode).type).toBe('span')
      expect(vnode.props.children![2]).toBe(' After')
    })
  })

  describe('htmlToSatoriVNode', () => {
    it('parses simple HTML', () => {
      const doc = parse('<div style="display: flex;">Hello</div>')
      const div = querySelector(doc, 'div') as ElementNode
      const vnode = elementToVNode(div)

      expect(vnode.type).toBe('div')
      expect(vnode.props.style).toEqual({ display: 'flex' })
      expect(vnode.props.children).toEqual(['Hello'])
    })

    it('handles complex nested structure', () => {
      const html = `
        <div style="display: flex; flex-direction: column;">
          <h1 class="text-4xl font-bold">Title</h1>
          <p style="color: gray;">Description</p>
        </div>
      `
      const doc = parse(html)
      const div = querySelector(doc, 'div') as ElementNode
      const vnode = elementToVNode(div)

      expect(vnode.type).toBe('div')
      expect(vnode.props.style).toEqual({
        display: 'flex',
        flexDirection: 'column',
      })

      const h1 = vnode.props.children![0] as SatoriVNode
      expect(h1.type).toBe('h1')
      expect(h1.props.tw).toBe('text-4xl font-bold')
      expect(h1.props.children).toEqual(['Title'])

      const p = vnode.props.children![1] as SatoriVNode
      expect(p.type).toBe('p')
      expect(p.props.style).toEqual({ color: 'gray' })
      expect(p.props.children).toEqual(['Description'])
    })

    it('preserves whitespace in text nodes where meaningful', () => {
      const doc = parse('<span>  spaced  </span>')
      const span = querySelector(doc, 'span') as ElementNode
      const vnode = elementToVNode(span)

      // Text content should preserve the whitespace
      expect(vnode.props.children![0]).toContain('spaced')
    })
  })

  describe('satori compatibility', () => {
    it('produces structure compatible with satori', () => {
      const doc = parse(`
        <div style="display: flex; width: 100%; height: 100%;">
          <img src="avatar.png" style="width: 64px; height: 64px;" />
          <div style="display: flex; flex-direction: column; margin-left: 16px;">
            <span style="font-size: 24px; font-weight: bold;">Username</span>
            <span style="color: #666;">@handle</span>
          </div>
        </div>
      `)
      const div = querySelector(doc, 'div') as ElementNode
      const vnode = elementToVNode(div)

      // Verify structure matches what satori expects
      expect(vnode).toHaveProperty('type')
      expect(vnode).toHaveProperty('props')
      expect(vnode.props).toHaveProperty('style')
      expect(vnode.props).toHaveProperty('children')

      // Check nested structure
      const img = vnode.props.children![0] as SatoriVNode
      expect(img.type).toBe('img')
      expect(img.props.src).toBe('avatar.png')
      expect(img.props.style).toEqual({
        width: '64px',
        height: '64px',
      })

      const textContainer = vnode.props.children![1] as SatoriVNode
      expect(textContainer.props.style).toEqual({
        display: 'flex',
        flexDirection: 'column',
        marginLeft: '16px',
      })
    })

    it('handles SVG elements', () => {
      const doc = parse(`
        <svg width="24" height="24" viewBox="0 0 24 24">
          <path d="M12 2L2 22h20L12 2z" fill="currentColor"/>
        </svg>
      `)
      const svg = querySelector(doc, 'svg') as ElementNode
      const vnode = elementToVNode(svg)

      expect(vnode.type).toBe('svg')
      expect(vnode.props.width).toBe('24')
      expect(vnode.props.height).toBe('24')
      expect(vnode.props.viewBox).toBe('0 0 24 24')

      const path = vnode.props.children![0] as SatoriVNode
      expect(path.type).toBe('path')
      expect(path.props.d).toBe('M12 2L2 22h20L12 2z')
      expect(path.props.fill).toBe('currentColor')
    })

    it('handles empty elements correctly', () => {
      const doc = parse('<div><br/><hr/></div>')
      const div = querySelector(doc, 'div') as ElementNode
      const vnode = elementToVNode(div)

      expect(vnode.props.children).toHaveLength(2)
      expect((vnode.props.children![0] as SatoriVNode).type).toBe('br')
      expect((vnode.props.children![1] as SatoriVNode).type).toBe('hr')
    })
  })

  describe('satori integration', () => {
    it.skipIf(!hasFonts)('renders ultrahtml-parsed HTML with satori', async () => {
      const html = `
        <div style="display: flex; flex-direction: column; width: 100%; height: 100%; background-color: white; padding: 40px;">
          <div style="display: flex; font-size: 48px; font-weight: bold; color: black;">Hello OG Image</div>
          <div style="display: flex; font-size: 24px; color: gray; margin-top: 16px;">Generated with ultrahtml + satori</div>
        </div>
      `
      const doc = parse(html)
      const root = querySelector(doc, 'div') as ElementNode
      const vnode = elementToVNode(root)

      const svg = await satori(vnode as any, {
        width: 1200,
        height: 630,
        fonts,
      })

      expect(svg).toContain('<svg')
      expect(svg).toContain('width="1200"')
      expect(svg).toContain('height="630"')
      // Text is rendered as paths, not text elements - verify we have path data
      expect(svg).toContain('<path')
    })

    it.skipIf(!hasFonts)('renders nested flex layout', async () => {
      const html = `
        <div style="display: flex; width: 100%; height: 100%; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);">
          <div style="display: flex; flex-direction: column; justify-content: center; padding: 60px;">
            <div style="display: flex; font-size: 64px; font-weight: 700; color: white;">Title Here</div>
            <div style="display: flex; font-size: 32px; color: rgba(255,255,255,0.8); margin-top: 20px;">Subtitle text</div>
          </div>
        </div>
      `
      const doc = parse(html)
      const root = querySelector(doc, 'div') as ElementNode
      const vnode = elementToVNode(root)

      const svg = await satori(vnode as any, {
        width: 1200,
        height: 630,
        fonts,
      })

      expect(svg).toContain('<svg')
      expect(svg).toContain('width="1200"')
      expect(svg).toContain('height="630"')
    })

    it.skipIf(!hasFonts)('handles images in vnodes', async () => {
      const html = `
        <div style="display: flex; width: 100%; height: 100%; background-color: #f0f0f0;">
          <img src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==" style="width: 100px; height: 100px; border-radius: 50px;" />
        </div>
      `
      const doc = parse(html)
      const root = querySelector(doc, 'div') as ElementNode
      const vnode = elementToVNode(root)

      const svg = await satori(vnode as any, {
        width: 400,
        height: 400,
        fonts,
      })

      expect(svg).toContain('<svg')
      expect(svg).toContain('<image')
    })

    it.skipIf(!hasFonts)('handles tw prop for tailwind classes', async () => {
      const html = `
        <div style="display: flex; width: 100%; height: 100%;" class="bg-blue-500 p-8">
          <div style="display: flex;" class="text-white text-4xl font-bold">Tailwind Test</div>
        </div>
      `
      const doc = parse(html)
      const root = querySelector(doc, 'div') as ElementNode
      const vnode = elementToVNode(root)

      // Verify tw prop is set
      expect(vnode.props.tw).toBe('bg-blue-500 p-8')
      expect((vnode.props.children![0] as SatoriVNode).props.tw).toBe('text-white text-4xl font-bold')

      // Satori should accept this (tw is processed by satori-tailwind)
      const svg = await satori(vnode as any, {
        width: 800,
        height: 400,
        fonts,
      })

      expect(svg).toContain('<svg')
    })
  })
})
