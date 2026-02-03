import type { ElementNode } from '@vue/compiler-core'
import type { ConsolaInstance } from 'consola'
import type { OgImageComponent } from '../runtime/types'
import { existsSync, mkdirSync } from 'node:fs'
import { readFile, writeFile } from 'node:fs/promises'
import { parse as parseSfc } from '@vue/compiler-sfc'
import { join } from 'pathe'
import { glob } from 'tinyglobby'
import { walkTemplateAst } from './tw4-utils'

const ELEMENT_NODE = 1
const ATTRIBUTE_NODE = 6
const DIRECTIVE_NODE = 7

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

const INLINE_FONT_WEIGHT_REGEX = /font-weight:\s*(\d+)/g

export interface FontRequirements {
  weights: number[]
  styles: Array<'normal' | 'italic'>
  isComplete: boolean
}

/**
 * Extract classes from a single Vue component using AST parsing.
 */
function extractClassesFromVue(code: string): string[] {
  const { descriptor } = parseSfc(code)
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
 * Extract all static class names from OG image component files.
 * Uses AST parsing for reliable extraction.
 */
export async function scanComponentClasses(componentDirs: string[], srcDir: string, logger?: ConsolaInstance): Promise<Set<string>> {
  const classes = new Set<string>()

  const patterns = componentDirs.map(dir => `**/${dir}/**/*.vue`)

  const files = await glob(patterns, {
    cwd: srcDir,
    absolute: true,
    ignore: ['**/node_modules/**'],
  })

  for (const file of files) {
    logger?.debug(`TW4: Scanning component ${file}`)
  }

  const contents = await Promise.all(
    files.map(file => readFile(file, 'utf-8').catch(() => null)),
  )

  for (const content of contents) {
    if (!content)
      continue

    for (const cls of extractClassesFromVue(content))
      classes.add(cls)
  }

  return classes
}

/**
 * Filter classes to only those that need TW4 processing.
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
 */
function extractFontRequirementsFromVue(code: string): { weights: Set<number>, styles: Set<'normal' | 'italic'>, isComplete: boolean } {
  const { descriptor } = parseSfc(code)

  const weights = new Set<number>()
  const styles = new Set<'normal' | 'italic'>(['normal'])
  let isComplete = true

  if (!descriptor.template?.ast)
    return { weights, styles, isComplete }

  walkTemplateAst(descriptor.template.ast.children, (node) => {
    if (node.type !== ELEMENT_NODE)
      return

    const el = node as ElementNode

    for (const prop of el.props) {
      if (prop.type === ATTRIBUTE_NODE && prop.name === 'class' && prop.value) {
        for (const cls of prop.value.content.split(/\s+/))
          extractFontWeightFromClass(cls, weights, styles)
      }

      if (prop.type === ATTRIBUTE_NODE && prop.name === 'style' && prop.value)
        extractFontWeightFromStyle(prop.value.content, weights, styles)

      if (prop.type === DIRECTIVE_NODE && prop.name === 'bind' && prop.arg?.type === 4) {
        const argContent = (prop.arg as any).content as string
        const expr = prop.exp

        if (argContent === 'class' && expr?.type === 4) {
          const content = (expr as any).content as string
          if (content.includes('props.') || content.includes('$props') || /\bfont(?:Weight|-weight)\b/i.test(content))
            isComplete = false
          for (const match of content.matchAll(/['"`]([\w:.\-]+)['"`]/g))
            extractFontWeightFromClass(match[1]!, weights, styles)
        }

        if (argContent === 'style' && expr?.type === 4) {
          const content = (expr as any).content as string
          if (/font-?weight/i.test(content) && (content.includes('props.') || content.includes('$props') || content.includes('?')))
            isComplete = false
          extractFontWeightFromStyle(content, weights, styles)
        }
      }
    }
  })

  return { weights, styles, isComplete }
}

function extractFontWeightFromClass(cls: string, weights: Set<number>, styles: Set<'normal' | 'italic'>): void {
  const baseClass = cls.replace(/^(?:sm:|md:|lg:|xl:|2xl:|dark:|hover:|focus:|active:)+/, '')
  const weight = FONT_WEIGHT_CLASSES[baseClass]
  if (weight !== undefined)
    weights.add(weight)
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

interface FontRequirementsCache {
  files: Record<string, { weights: number[], styles: Array<'normal' | 'italic'>, isComplete: boolean }>
}

/**
 * Scan OG image components for font requirements (weights, styles).
 */
export async function scanFontRequirements(
  components: OgImageComponent[],
  logger?: ConsolaInstance,
  cacheDir?: string,
): Promise<FontRequirements> {
  const allWeights = new Set<number>()
  const allStyles = new Set<'normal' | 'italic'>(['normal'])
  let isComplete = true

  const cacheFile = cacheDir ? join(cacheDir, 'cache', 'og-image', 'font-requirements.json') : null
  let cache: FontRequirementsCache = { files: {} }
  if (cacheFile && existsSync(cacheFile)) {
    cache = await readFile(cacheFile, 'utf-8')
      .then(c => JSON.parse(c) as FontRequirementsCache)
      .catch(() => ({ files: {} }))
  }

  const seenHashes = new Set<string>()

  for (const component of components) {
    if (!component.path)
      continue

    seenHashes.add(component.hash)

    const cached = cache.files[component.hash]
    if (cached) {
      for (const w of cached.weights) allWeights.add(w)
      for (const s of cached.styles) allStyles.add(s)
      if (!cached.isComplete)
        isComplete = false
      continue
    }

    const content = await readFile(component.path, 'utf-8').catch(() => null)
    if (!content)
      continue

    const result = extractFontRequirementsFromVue(content)
    cache.files[component.hash] = {
      weights: [...result.weights],
      styles: [...result.styles] as Array<'normal' | 'italic'>,
      isComplete: result.isComplete,
    }

    for (const w of result.weights) allWeights.add(w)
    for (const s of result.styles) allStyles.add(s)
    if (!result.isComplete)
      isComplete = false
  }

  // Cleanup stale entries
  for (const hash of Object.keys(cache.files)) {
    if (!seenHashes.has(hash))
      delete cache.files[hash]
  }

  if (cacheFile) {
    mkdirSync(join(cacheDir!, 'cache', 'og-image'), { recursive: true })
    await writeFile(cacheFile, JSON.stringify(cache))
  }

  allWeights.add(400) // always include 400 as fallback

  const weights = [...allWeights].sort((a, b) => a - b)
  const styles = [...allStyles] as Array<'normal' | 'italic'>

  logger?.debug(`Fonts: Detected weights [${weights.join(', ')}], styles [${styles.join(', ')}]${isComplete ? '' : ' (incomplete analysis)'}`)

  return { weights, styles, isComplete }
}
