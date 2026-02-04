import type { ElementNode } from '@vue/compiler-core'
import type { ConsolaInstance } from 'consola'
import type { OgImageComponent } from '../../runtime/types'
import { existsSync, mkdirSync } from 'node:fs'
import { readFile, writeFile } from 'node:fs/promises'
import { join } from 'pathe'
import { walkTemplateAst } from './css-utils'

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

export interface FontRequirements {
  weights: number[]
  styles: Array<'normal' | 'italic'>
  /** false if dynamic patterns detected that couldn't be analyzed */
  isComplete: boolean
}

export interface ComponentFontRequirements {
  weights: number[]
  styles: Array<'normal' | 'italic'>
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
async function extractFontRequirementsFromVue(code: string): Promise<{ weights: Set<number>, styles: Set<'normal' | 'italic'>, isComplete: boolean }> {
  const parse = await loadParser()
  const { descriptor } = parse(code)

  const weights = new Set<number>()
  const styles = new Set<'normal' | 'italic'>(['normal']) // Always include normal as default
  let isComplete = true

  if (!descriptor.template?.ast)
    return { weights, styles, isComplete }

  walkTemplateAst(descriptor.template.ast.children, (node) => {
    if (node.type !== ELEMENT_NODE)
      return

    const el = node as ElementNode

    for (const prop of el.props) {
      // Static class="..."
      if (prop.type === ATTRIBUTE_NODE && prop.name === 'class' && prop.value) {
        for (const cls of prop.value.content.split(/\s+/)) {
          extractFontWeightFromClass(cls, weights, styles)
        }
      }

      // Static style="..."
      if (prop.type === ATTRIBUTE_NODE && prop.name === 'style' && prop.value) {
        extractFontWeightFromStyle(prop.value.content, weights, styles)
      }

      // Dynamic :class bindings
      if (prop.type === DIRECTIVE_NODE && prop.name === 'bind' && prop.arg?.type === 4) {
        const argContent = (prop.arg as any).content as string
        const expr = prop.exp

        if (argContent === 'class' && expr?.type === 4) {
          const content = (expr as any).content as string
          // Check for dynamic patterns we can't analyze
          if (content.includes('props.') || content.includes('$props') || /\bfont(?:Weight|-weight)\b/i.test(content)) {
            isComplete = false
          }
          // Extract static class strings from expression
          for (const match of content.matchAll(/['"`]([\w:.\-]+)['"`]/g)) {
            extractFontWeightFromClass(match[1]!, weights, styles)
          }
        }

        // Dynamic :style bindings
        if (argContent === 'style' && expr?.type === 4) {
          const content = (expr as any).content as string
          // Check for dynamic font-weight patterns
          if (/font-?weight/i.test(content) && (content.includes('props.') || content.includes('$props') || content.includes('?'))) {
            isComplete = false
          }
          extractFontWeightFromStyle(content, weights, styles)
        }
      }
    }
  })

  return { weights, styles, isComplete }
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

interface FontRequirementsCache {
  files: Record<string, { weights: number[], styles: Array<'normal' | 'italic'>, isComplete: boolean }>
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
      if (!cached.isComplete)
        isComplete = false
      // Store per-component (always include 400 as default)
      const compWeights = cached.weights.length ? [...cached.weights] : [400]
      if (!compWeights.includes(400))
        compWeights.push(400)
      componentMap[component.pascalName] = {
        weights: compWeights.sort((a, b) => a - b),
        styles: [...cached.styles] as Array<'normal' | 'italic'>,
        isComplete: cached.isComplete,
      }
      continue
    }

    // Parse component
    const content = await readFile(component.path, 'utf-8').catch(() => null)
    if (!content) {
      cache.files[cacheKey] = { weights: [], styles: ['normal'], isComplete: true }
      componentMap[component.pascalName] = { weights: [400], styles: ['normal'], isComplete: true }
      continue
    }

    const result = await extractFontRequirementsFromVue(content)
    cache.files[cacheKey] = {
      weights: [...result.weights],
      styles: [...result.styles] as Array<'normal' | 'italic'>,
      isComplete: result.isComplete,
    }

    for (const w of result.weights) allWeights.add(w)
    for (const s of result.styles) allStyles.add(s)
    if (!result.isComplete)
      isComplete = false

    // Store per-component (always include 400 as default)
    const compWeights = [...result.weights]
    if (!compWeights.includes(400))
      compWeights.push(400)
    componentMap[component.pascalName] = {
      weights: compWeights.sort((a, b) => a - b),
      styles: [...result.styles] as Array<'normal' | 'italic'>,
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

  logger?.debug(`Fonts: Detected weights [${weights.join(', ')}], styles [${styles.join(', ')}]${isComplete ? '' : ' (incomplete analysis)'}`)

  return {
    global: { weights, styles, isComplete },
    components: componentMap,
  }
}
