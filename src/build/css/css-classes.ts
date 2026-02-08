import type { ElementNode } from '@vue/compiler-core'
import type { ConsolaInstance } from 'consola'
import type { OgImageComponent } from '../../runtime/types'
import { existsSync, mkdirSync } from 'node:fs'
import { readFile, writeFile } from 'node:fs/promises'
import { join } from 'pathe'
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
  isComplete: boolean
}

export interface FontRequirementsResult {
  global: FontRequirements
  components: Record<string, FontRequirements>
}

const ELEMENT_NODE = 1
const ATTRIBUTE_NODE = 6
const DIRECTIVE_NODE = 7

/**
 * Extract font requirements from a single Vue component.
 */
async function extractFontRequirementsFromVue(code: string): Promise<{
  weights: Set<number>
  styles: Set<'normal' | 'italic'>
  familyClasses: Set<string>
  familyNames: Set<string>
  isComplete: boolean
}> {
  const parse = await loadParser()
  const { descriptor } = parse(code)

  const weights = new Set<number>()
  const styles = new Set<'normal' | 'italic'>(['normal'])
  const familyClasses = new Set<string>()
  const familyNames = new Set<string>()
  let isComplete = true

  if (!descriptor.template?.ast)
    return { weights, styles, familyClasses, familyNames, isComplete }

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
            isComplete = false
          }
          for (const match of content.matchAll(/['"`]([\w:.\-[\]'"]+)['"`]/g)) {
            extractFontWeightFromClass(match[1]!, weights, styles)
            extractFontFamilyFromClass(match[1]!, familyClasses, familyNames)
          }
        }

        if (argContent === 'style' && expr?.type === 4) {
          const content = (expr as any).content as string
          if (/font-?(?:weight|family)/i.test(content) && (content.includes('props.') || content.includes('$props') || content.includes('?'))) {
            isComplete = false
          }
          extractFontWeightFromStyle(content, weights, styles)
          extractFontFamilyFromStyle(content, familyNames)
          extractFontFamilyFromJsStyle(content, familyNames)
        }
      }
    }
  })

  return { weights, styles, familyClasses, familyNames, isComplete }
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

interface FontRequirementsCache {
  files: Record<string, {
    weights: number[]
    styles: Array<'normal' | 'italic'>
    familyClasses: string[]
    familyNames: string[]
    isComplete: boolean
  }>
}

/**
 * Scan OG image components for font requirements.
 */
export async function scanFontRequirements(
  components: OgImageComponent[],
  logger?: ConsolaInstance,
  cacheDir?: string,
): Promise<FontRequirementsResult> {
  const allWeights = new Set<number>()
  const allStyles = new Set<'normal' | 'italic'>(['normal'])
  const allFamilyClasses = new Set<string>()
  const allFamilyNames = new Set<string>()
  let isComplete = true
  const componentMap: Record<string, FontRequirements> = {}

  const cacheFile = cacheDir ? join(cacheDir, 'cache', 'og-image', 'font-requirements.json') : null
  let cache: FontRequirementsCache = { files: {} }
  if (cacheFile && existsSync(cacheFile)) {
    cache = await readFile(cacheFile, 'utf-8')
      .then(c => JSON.parse(c) as FontRequirementsCache)
      .catch(() => ({ files: {} }))
  }

  const seenKeys = new Set<string>()
  const seenPaths = new Set<string>()

  for (const component of components) {
    if (!component.path)
      continue
    if (seenPaths.has(component.path))
      continue
    seenPaths.add(component.path)

    const cacheKey = component.hash || component.path
    seenKeys.add(cacheKey)

    const cached = cache.files[cacheKey]
    if (cached) {
      for (const w of cached.weights) allWeights.add(w)
      for (const s of cached.styles) allStyles.add(s)
      for (const c of cached.familyClasses || []) allFamilyClasses.add(c)
      for (const n of cached.familyNames || []) allFamilyNames.add(n)
      if (!cached.isComplete)
        isComplete = false
      const compWeights = cached.weights.length ? [...cached.weights] : [400]
      if (!compWeights.includes(400))
        compWeights.push(400)
      componentMap[component.pascalName] = {
        weights: compWeights.sort((a, b) => a - b),
        styles: [...cached.styles] as Array<'normal' | 'italic'>,
        familyClasses: cached.familyClasses || [],
        familyNames: cached.familyNames || [],
        isComplete: cached.isComplete,
      }
      continue
    }

    const content = await readFile(component.path, 'utf-8').catch(() => null)
    if (!content) {
      cache.files[cacheKey] = { weights: [], styles: ['normal'], familyClasses: [], familyNames: [], isComplete: true }
      componentMap[component.pascalName] = { weights: [400], styles: ['normal'], familyClasses: [], familyNames: [], isComplete: true }
      continue
    }

    const result = await extractFontRequirementsFromVue(content)
    cache.files[cacheKey] = {
      weights: [...result.weights],
      styles: [...result.styles] as Array<'normal' | 'italic'>,
      familyClasses: [...result.familyClasses],
      familyNames: [...result.familyNames],
      isComplete: result.isComplete,
    }

    for (const w of result.weights) allWeights.add(w)
    for (const s of result.styles) allStyles.add(s)
    for (const c of result.familyClasses) allFamilyClasses.add(c)
    for (const n of result.familyNames) allFamilyNames.add(n)
    if (!result.isComplete)
      isComplete = false

    const compWeights = [...result.weights]
    if (!compWeights.includes(400))
      compWeights.push(400)
    componentMap[component.pascalName] = {
      weights: compWeights.sort((a, b) => a - b),
      styles: [...result.styles] as Array<'normal' | 'italic'>,
      familyClasses: [...result.familyClasses],
      familyNames: [...result.familyNames],
      isComplete: result.isComplete,
    }
  }

  for (const key of Object.keys(cache.files)) {
    if (!seenKeys.has(key))
      delete cache.files[key]
  }

  if (cacheFile) {
    const cacheParent = join(cacheDir!, 'cache', 'og-image')
    mkdirSync(cacheParent, { recursive: true })
    await writeFile(cacheFile, JSON.stringify(cache))
  }

  allWeights.add(400)

  const weights = [...allWeights].sort((a, b) => a - b)
  const styles = [...allStyles] as Array<'normal' | 'italic'>
  const familyClasses = [...allFamilyClasses]
  const familyNames = [...allFamilyNames]

  logger?.debug(`Fonts: Detected weights [${weights.join(', ')}], styles [${styles.join(', ')}]${familyClasses.length || familyNames.length ? `, families [classes: ${familyClasses.join(', ') || 'none'}, names: ${familyNames.join(', ') || 'none'}]` : ''}${isComplete ? '' : ' (incomplete analysis)'}`)

  return {
    global: { weights, styles, familyClasses, familyNames, isComplete },
    components: componentMap,
  }
}
