import type { ElementNode } from '@vue/compiler-core'
import { readFile } from 'node:fs/promises'
import { parse as parseSfc } from '@vue/compiler-sfc'
import { glob } from 'tinyglobby'
import { walkTemplateAst } from './tw4-utils'

const ELEMENT_NODE = 1
const ATTRIBUTE_NODE = 6
const DIRECTIVE_NODE = 7

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
export async function scanComponentClasses(componentDirs: string[], srcDir: string): Promise<Set<string>> {
  const classes = new Set<string>()

  const patterns = componentDirs.map(dir => `**/${dir}/**/*.vue`)

  const files = await glob(patterns, {
    cwd: srcDir,
    absolute: true,
    ignore: ['**/node_modules/**'],
  })

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
