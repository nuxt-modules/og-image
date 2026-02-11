import type { ElementNode } from '@vue/compiler-core'
import { extractCustomFontFamilies, walkTemplateAst } from './css-utils'

// Lazy-loaded to reduce startup memory
let parseSfc: typeof import('@vue/compiler-sfc').parse | undefined

async function loadParser() {
  if (!parseSfc)
    parseSfc = (await import('@vue/compiler-sfc')).parse
  return parseSfc
}

// TW/UnoCSS font weight class mappings
const FONT_WEIGHT_CLASSES: Record<string, number> = {
  'font-thin': 100,
  'font-extralight': 200,
  'font-light': 300,
  'font-normal': 400,
  'font-medium': 500,
  'font-semibold': 600,
  'font-bold': 700,
  'font-extrabold': 800,
  'font-black': 900,
}

// Regex for inline font-weight in style attributes
const INLINE_FONT_WEIGHT_REGEX = /font-weight:\s*(\d+)/g

// Regex for inline font-family in style attributes
const INLINE_FONT_FAMILY_REGEX = /font-family:\s*([^;]+)/gi

// font-* classes that are NOT font-family classes
const FONT_NON_FAMILY_CLASSES = new Set([
  ...Object.keys(FONT_WEIGHT_CLASSES),
  'italic',
  'not-italic',
])

export interface FontRequirements {
  weights: number[]
  styles: Array<'normal' | 'italic'>
  familyClasses: string[]
  familyNames: string[]
  hasDynamicBindings: boolean
}

const ELEMENT_NODE = 1
const ATTRIBUTE_NODE = 6
const DIRECTIVE_NODE = 7

/**
 * Extract font requirements from a single Vue component.
 */
export async function extractFontRequirementsFromVue(code: string): Promise<{
  weights: Set<number>
  styles: Set<'normal' | 'italic'>
  familyClasses: Set<string>
  familyNames: Set<string>
  hasDynamicBindings: boolean
}> {
  const parse = await loadParser()
  const { descriptor } = parse(code)

  const weights = new Set<number>()
  const styles = new Set<'normal' | 'italic'>(['normal'])
  const familyClasses = new Set<string>()
  const familyNames = new Set<string>()
  let hasDynamicBindings = false

  if (!descriptor.template?.ast)
    return { weights, styles, familyClasses, familyNames, hasDynamicBindings }

  walkTemplateAst(descriptor.template.ast.children, (node) => {
    if (node.type !== ELEMENT_NODE)
      return

    const el = node as ElementNode

    for (const prop of el.props) {
      // Static class="..."
      if (prop.type === ATTRIBUTE_NODE && prop.name === 'class' && prop.value) {
        for (const cls of prop.value.content.split(/\s+/)) {
          extractFontWeightFromClass(cls, weights, styles)
          extractFontFamilyFromClass(cls, familyClasses, familyNames)
        }
      }

      // Static style="..."
      if (prop.type === ATTRIBUTE_NODE && prop.name === 'style' && prop.value) {
        extractFontWeightFromStyle(prop.value.content, weights, styles)
        extractFontFamilyFromStyle(prop.value.content, familyNames)
      }

      // Dynamic :class/:style bindings
      if (prop.type === DIRECTIVE_NODE && prop.name === 'bind' && prop.arg?.type === 4) {
        const argContent = (prop.arg as any).content as string
        const expr = prop.exp

        if (argContent === 'class' && expr?.type === 4) {
          const content = (expr as any).content as string
          if (content.includes('props.') || content.includes('$props') || /\bfont(?:Weight|Family|-weight|-family)\b/i.test(content)) {
            hasDynamicBindings = true
          }
          for (const match of content.matchAll(/['"`]([\w:.\-[\]'"]+)['"`]/g)) {
            extractFontWeightFromClass(match[1]!, weights, styles)
            extractFontFamilyFromClass(match[1]!, familyClasses, familyNames)
          }
        }

        if (argContent === 'style' && expr?.type === 4) {
          const content = (expr as any).content as string
          if (/font-?(?:weight|family)/i.test(content) && (content.includes('props.') || content.includes('$props') || content.includes('?'))) {
            hasDynamicBindings = true
          }
          extractFontWeightFromStyle(content, weights, styles)
          extractFontFamilyFromStyle(content, familyNames)
          extractFontFamilyFromJsStyle(content, familyNames)
        }
      }
    }
  })

  return { weights, styles, familyClasses, familyNames, hasDynamicBindings }
}

function extractFontWeightFromClass(cls: string, weights: Set<number>, styles: Set<'normal' | 'italic'>): void {
  const baseClass = cls.replace(/^(?:sm:|md:|lg:|xl:|2xl:|dark:|hover:|focus:|active:)+/, '')
  const weight = FONT_WEIGHT_CLASSES[baseClass]
  if (weight !== undefined) {
    weights.add(weight)
    return
  }
  // Tailwind arbitrary weight: font-[700], font-[800]
  const arbitraryWeight = baseClass.match(/^font-\[(\d+)\]$/)
  if (arbitraryWeight) {
    const w = Number.parseInt(arbitraryWeight[1]!, 10)
    if (w >= 100 && w <= 900)
      weights.add(w)
    return
  }
  if (baseClass === 'italic')
    styles.add('italic')
}

function extractFontWeightFromStyle(style: string, weights: Set<number>, styles: Set<'normal' | 'italic'>): void {
  for (const match of style.matchAll(INLINE_FONT_WEIGHT_REGEX)) {
    const weight = Number.parseInt(match[1]!, 10)
    if (weight >= 100 && weight <= 900)
      weights.add(weight)
  }
  if (/font-style:\s*italic/i.test(style))
    styles.add('italic')
}

function extractFontFamilyFromClass(cls: string, familyClasses: Set<string>, familyNames: Set<string>): void {
  const baseClass = cls.replace(/^(?:sm:|md:|lg:|xl:|2xl:|dark:|hover:|focus:|active:)+/, '')
  if (!baseClass.startsWith('font-'))
    return
  if (FONT_NON_FAMILY_CLASSES.has(baseClass))
    return
  const suffix = baseClass.slice(5)
  if (!suffix)
    return
  const arbitraryMatch = suffix.match(/^\[['"]?(.+?)['"]?\]$/)
  if (arbitraryMatch) {
    const value = arbitraryMatch[1]!
    // Skip numeric values — those are font-weight (e.g. font-[700]), not font-family
    if (/^\d+$/.test(value))
      return
    familyNames.add(value)
    return
  }
  familyClasses.add(suffix)
}

function extractFontFamilyFromStyle(style: string, familyNames: Set<string>): void {
  for (const match of style.matchAll(INLINE_FONT_FAMILY_REGEX)) {
    for (const name of extractCustomFontFamilies(match[1]!))
      familyNames.add(name)
  }
}

function extractFontFamilyFromJsStyle(content: string, familyNames: Set<string>): void {
  for (const match of content.matchAll(/fontFamily:\s*['"]([^'"]+)['"]/g)) {
    for (const name of extractCustomFontFamilies(match[1]!))
      familyNames.add(name)
  }
}
