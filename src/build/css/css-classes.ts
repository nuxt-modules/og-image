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
  /** Font family class suffixes detected (e.g., 'sans', 'serif', 'inter') */
  familyClasses: string[]
  /** Direct font family names from inline styles (e.g., 'Inter') */
  familyNames: string[]
  /** false if dynamic patterns detected that couldn't be analyzed */
  isComplete: boolean
}

export interface ComponentFontRequirements {
  weights: number[]
  styles: Array<'normal' | 'italic'>
  familyClasses: string[]
  familyNames: string[]
  isComplete: boolean
}

export interface FontRequirementsResult {
  /** Global union (for build-time font bundling + WOFF2 filtering) */
  global: FontRequirements
  /** Per-component map keyed by pascalName */
  components: Record<string, ComponentFontRequirements>
}

interface CssClassCache {
  // keyed by component hash (already computed from path+mtime)
  files: Record<string, string[]>
}

const ELEMENT_NODE = 1
const ATTRIBUTE_NODE = 6
const DIRECTIVE_NODE = 7

/**
 * Extract classes from a single Vue component using AST parsing.
 */
async function extractClassesFromVue(code: string): Promise<string[]> {
  const parse = await loadParser()
  const { descriptor } = parse(code)
  if (!descriptor.template?.ast)
    return []

  const classes: string[] = []

  walkTemplateAst(descriptor.template.ast.children, (node) => {
    if (node.type !== ELEMENT_NODE)
      return

    const el = node as ElementNode

    for (const prop of el.props) {
      // Static class="..."
      if (prop.type === ATTRIBUTE_NODE && prop.name === 'class' && prop.value) {
        for (const cls of prop.value.content.split(/\s+/)) {
          if (cls && !cls.includes('{') && !cls.includes('$'))
            classes.push(cls)
        }
      }

      // Dynamic :class bindings
      if (prop.type === DIRECTIVE_NODE && prop.name === 'bind' && prop.arg?.type === 4 && (prop.arg as any).content === 'class') {
        const expr = prop.exp
        if (expr?.type === 4) {
          // Simple expression - extract string literals
          const content = (expr as any).content as string
          extractClassesFromExpression(content, classes)
        }
      }
    }
  })

  return classes
}

/**
 * Extract class names from a Vue expression string.
 * Handles: 'class', `class`, { 'class': cond }, [cond ? 'a' : 'b'], arrays, objects
 */
function extractClassesFromExpression(expr: string, classes: string[]): void {
  // Match all quoted strings (single, double, backtick)
  for (const match of expr.matchAll(/['"`]([\w:.\-/]+)['"`]/g)) {
    const cls = match[1]
    if (cls && !cls.includes('{') && !cls.includes('$') && !cls.includes('/'))
      classes.push(cls)
  }
}

/**
 * Extract all static class names from OG image components.
 * Uses pre-computed component hashes for caching (no glob/stat needed).
 */
export async function scanComponentClasses(
  components: OgImageComponent[],
  logger?: ConsolaInstance,
  cacheDir?: string,
): Promise<Set<string>> {
  const classes = new Set<string>()

  // Load cache if available (keyed by component hash)
  const cacheFile = cacheDir ? join(cacheDir, 'cache', 'og-image', 'css-classes.json') : null
  let cache: CssClassCache = { files: {} }
  if (cacheFile && existsSync(cacheFile)) {
    cache = await readFile(cacheFile, 'utf-8')
      .then(c => JSON.parse(c) as CssClassCache)
      .catch(() => ({ files: {} }))
  }

  const seenKeys = new Set<string>()
  const seenPaths = new Set<string>()
  let cacheHits = 0
  let cacheMisses = 0

  // Process components sequentially - one file in memory at a time
  for (const component of components) {
    if (!component.path)
      continue

    // Dedup by path - same file only scanned once
    if (seenPaths.has(component.path))
      continue
    seenPaths.add(component.path)

    // Use hash as cache key, fall back to path when hash is empty
    const cacheKey = component.hash || component.path
    seenKeys.add(cacheKey)

    // Use cached classes if available
    const cached = cache.files[cacheKey]
    if (cached) {
      cacheHits++
      for (const cls of cached)
        classes.add(cls)
      continue
    }

    // Cache miss - read and parse file
    cacheMisses++
    logger?.debug(`CSS: Scanning component ${component.path}`)
    const content = await readFile(component.path, 'utf-8').catch(() => null)
    if (!content) {
      // Cache empty result to avoid re-scanning on next invocation
      cache.files[cacheKey] = []
      continue
    }

    const fileClasses = await extractClassesFromVue(content)
    cache.files[cacheKey] = fileClasses

    for (const cls of fileClasses)
      classes.add(cls)
  }

  // Cleanup stale cache entries (components no longer present)
  for (const key of Object.keys(cache.files)) {
    if (!seenKeys.has(key))
      delete cache.files[key]
  }

  // Write cache
  if (cacheFile) {
    const cacheParent = join(cacheDir!, 'cache', 'og-image')
    mkdirSync(cacheParent, { recursive: true })
    await writeFile(cacheFile, JSON.stringify(cache))
  }

  if (cacheHits > 0 || cacheMisses > 0)
    logger?.debug(`CSS: Class cache - ${cacheHits} hits, ${cacheMisses} misses`)

  return classes
}

/**
 * Filter classes to only those that need CSS processing.
 * Excludes responsive prefixes (handled at runtime) and unsupported classes.
 */
export function filterProcessableClasses(classes: Set<string>): string[] {
  const processable: string[] = []
  const responsivePrefixes = ['sm:', 'md:', 'lg:', 'xl:', '2xl:']

  for (const cls of classes) {
    // Skip responsive variants - handled at runtime
    if (responsivePrefixes.some(p => cls.startsWith(p))) {
      const baseClass = cls.replace(/^(sm|md|lg|xl|2xl):/, '')
      if (baseClass)
        processable.push(baseClass)
      continue
    }

    // Skip state variants that Satori can't handle
    if (cls.includes('hover:') || cls.includes('focus:') || cls.includes('active:'))
      continue

    // Skip dark mode variants
    if (cls.startsWith('dark:'))
      continue

    processable.push(cls)
  }

  return [...new Set(processable)]
}

/**
 * Extract font weights from a Vue component.
 * Analyzes classes and inline styles to determine required font weights.
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
  const styles = new Set<'normal' | 'italic'>(['normal']) // Always include normal as default
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

      // Dynamic :class bindings
      if (prop.type === DIRECTIVE_NODE && prop.name === 'bind' && prop.arg?.type === 4) {
        const argContent = (prop.arg as any).content as string
        const expr = prop.exp

        if (argContent === 'class' && expr?.type === 4) {
          const content = (expr as any).content as string
          // Check for dynamic patterns we can't analyze
          if (content.includes('props.') || content.includes('$props') || /\bfont(?:Weight|Family|-weight|-family)\b/i.test(content)) {
            isComplete = false
          }
          // Extract static class strings from expression
          for (const match of content.matchAll(/['"`]([\w:.\-[\]'"]+)['"`]/g)) {
            extractFontWeightFromClass(match[1]!, weights, styles)
            extractFontFamilyFromClass(match[1]!, familyClasses, familyNames)
          }
        }

        // Dynamic :style bindings
        if (argContent === 'style' && expr?.type === 4) {
          const content = (expr as any).content as string
          // Check for dynamic font-weight/font-family patterns
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

/**
 * Extract font weight from a class name (handles responsive/dark prefixes).
 */
function extractFontWeightFromClass(cls: string, weights: Set<number>, styles: Set<'normal' | 'italic'>): void {
  // Strip common prefixes: sm:, md:, lg:, xl:, 2xl:, dark:, hover:, etc.
  const baseClass = cls.replace(/^(?:sm:|md:|lg:|xl:|2xl:|dark:|hover:|focus:|active:)+/, '')

  // Check font weight classes
  const weight = FONT_WEIGHT_CLASSES[baseClass]
  if (weight !== undefined) {
    weights.add(weight)
  }

  // Check for italic
  if (baseClass === 'italic') {
    styles.add('italic')
  }
}

/**
 * Extract font weight from inline style content.
 */
function extractFontWeightFromStyle(style: string, weights: Set<number>, styles: Set<'normal' | 'italic'>): void {
  // Match font-weight: <number>
  for (const match of style.matchAll(INLINE_FONT_WEIGHT_REGEX)) {
    const weight = Number.parseInt(match[1]!, 10)
    if (weight >= 100 && weight <= 900) {
      weights.add(weight)
    }
  }

  // Match font-style: italic
  if (/font-style:\s*italic/i.test(style)) {
    styles.add('italic')
  }
}

/**
 * Extract font family from a class name.
 * Detects font-* classes that aren't weight/style classes (e.g., font-sans, font-inter).
 * Also handles arbitrary values like font-['Inter'].
 */
function extractFontFamilyFromClass(cls: string, familyClasses: Set<string>, familyNames: Set<string>): void {
  const baseClass = cls.replace(/^(?:sm:|md:|lg:|xl:|2xl:|dark:|hover:|focus:|active:)+/, '')
  if (!baseClass.startsWith('font-'))
    return
  if (FONT_NON_FAMILY_CLASSES.has(baseClass))
    return

  const suffix = baseClass.slice(5)
  if (!suffix)
    return

  // Arbitrary value: font-['Inter'] or font-["Inter"] or font-[Inter]
  const arbitraryMatch = suffix.match(/^\[['"]?(.+?)['"]?\]$/)
  if (arbitraryMatch) {
    familyNames.add(arbitraryMatch[1]!)
    return
  }

  familyClasses.add(suffix)
}

/**
 * Extract font family names from inline CSS style content.
 */
function extractFontFamilyFromStyle(style: string, familyNames: Set<string>): void {
  for (const match of style.matchAll(INLINE_FONT_FAMILY_REGEX)) {
    parseFontFamilyValue(match[1]!, familyNames)
  }
}

/**
 * Extract font family names from JS-style object notation (e.g., { fontFamily: 'Inter' }).
 */
function extractFontFamilyFromJsStyle(content: string, familyNames: Set<string>): void {
  for (const match of content.matchAll(/fontFamily:\s*['"]([^'"]+)['"]/g)) {
    parseFontFamilyValue(match[1]!, familyNames)
  }
}

/**
 * Parse a CSS font-family value and add non-generic family names to the set.
 */
function parseFontFamilyValue(value: string, familyNames: Set<string>): void {
  for (const name of extractCustomFontFamilies(value))
    familyNames.add(name)
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
 * Returns weights, styles, and whether analysis was complete.
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
  const componentMap: Record<string, ComponentFontRequirements> = {}

  // Load cache
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

    // Dedup by path
    if (seenPaths.has(component.path))
      continue
    seenPaths.add(component.path)

    const cacheKey = component.hash || component.path
    seenKeys.add(cacheKey)

    // Use cache if available
    const cached = cache.files[cacheKey]
    if (cached) {
      for (const w of cached.weights) allWeights.add(w)
      for (const s of cached.styles) allStyles.add(s)
      for (const c of cached.familyClasses || []) allFamilyClasses.add(c)
      for (const n of cached.familyNames || []) allFamilyNames.add(n)
      if (!cached.isComplete)
        isComplete = false
      // Store per-component (always include 400 as default)
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

    // Parse component
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

    // Store per-component (always include 400 as default)
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

  // Cleanup stale entries
  for (const key of Object.keys(cache.files)) {
    if (!seenKeys.has(key))
      delete cache.files[key]
  }

  // Write cache
  if (cacheFile) {
    const cacheParent = join(cacheDir!, 'cache', 'og-image')
    mkdirSync(cacheParent, { recursive: true })
    await writeFile(cacheFile, JSON.stringify(cache))
  }

  // Always include 400 as fallback (most common default weight)
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
