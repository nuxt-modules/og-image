import type { ElementNode } from '@vue/compiler-core'
import type { ConsolaInstance } from 'consola'
import type { OgImageComponent } from '../runtime/types'
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

interface Tw4ClassCache {
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
  const cacheFile = cacheDir ? join(cacheDir, 'cache', 'og-image', 'tw4-classes.json') : null
  let cache: Tw4ClassCache = { files: {} }
  if (cacheFile && existsSync(cacheFile)) {
    cache = await readFile(cacheFile, 'utf-8')
      .then(c => JSON.parse(c) as Tw4ClassCache)
      .catch(() => ({ files: {} }))
  }

  const seenHashes = new Set<string>()
  let cacheHits = 0
  let cacheMisses = 0

  // Process components sequentially - one file in memory at a time
  for (const component of components) {
    if (!component.path)
      continue

    seenHashes.add(component.hash)

    // Use cached classes if hash matches
    const cached = cache.files[component.hash]
    if (cached) {
      cacheHits++
      for (const cls of cached)
        classes.add(cls)
      continue
    }

    // Cache miss - read and parse file
    cacheMisses++
    logger?.debug(`TW4: Scanning component ${component.path}`)
    const content = await readFile(component.path, 'utf-8').catch(() => null)
    if (!content)
      continue

    const fileClasses = await extractClassesFromVue(content)
    cache.files[component.hash] = fileClasses

    for (const cls of fileClasses)
      classes.add(cls)
  }

  // Cleanup stale cache entries (components no longer present)
  for (const hash of Object.keys(cache.files)) {
    if (!seenHashes.has(hash))
      delete cache.files[hash]
  }

  // Write cache
  if (cacheFile) {
    const cacheParent = join(cacheDir!, 'cache', 'og-image')
    mkdirSync(cacheParent, { recursive: true })
    await writeFile(cacheFile, JSON.stringify(cache))
  }

  if (cacheHits > 0 || cacheMisses > 0)
    logger?.debug(`TW4: Class cache - ${cacheHits} hits, ${cacheMisses} misses`)

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
