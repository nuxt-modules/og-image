import type { ElementNode } from '@vue/compiler-core'
import { parse as parseSfc } from '@vue/compiler-sfc'
import MagicString from 'magic-string'
import { logger } from '../runtime/logger'
import { walkTemplateAst } from './css/css-utils'

export interface ClassToStyleOptions {
  /** Resolve classes to inline CSS styles */
  resolveStyles: (classes: string[]) => Promise<Record<string, Record<string, string>>>
}

interface StyleCollector {
  classes: string[]
  classLoc?: { start: number, end: number }
  existingStyle?: string
  styleLoc?: { start: number, end: number }
  elementLoc: { start: number, end: number }
  hasDynamicStyle?: boolean // :style binding detected
}

const ELEMENT_NODE = 1
const ATTRIBUTE_NODE = 6
const DIRECTIVE_NODE = 7

// Escape quotes for HTML attribute values
function escapeAttrValue(value: string): string {
  return value.replace(/"/g, '&quot;')
}

/**
 * Transform Vue SFC template: convert Tailwind classes to inline styles
 */
export async function transformVueTemplate(
  code: string,
  options: ClassToStyleOptions,
): Promise<{ code: string, map: ReturnType<MagicString['generateMap']> } | undefined> {
  const { descriptor } = parseSfc(code)
  if (!descriptor.template?.ast)
    return undefined

  const s = new MagicString(code)
  const collectors: StyleCollector[] = []

  // Walk AST and collect class/style info
  walkTemplateAst(descriptor.template.ast.children, (node) => {
    if (node.type !== ELEMENT_NODE)
      return

    const el = node as ElementNode
    const collector: StyleCollector = {
      classes: [],
      elementLoc: { start: el.loc.start.offset, end: el.loc.end.offset },
    }

    for (const prop of el.props) {
      // Static class attribute (type 6)
      if (prop.type === ATTRIBUTE_NODE && prop.name === 'class' && prop.value) {
        collector.classes = prop.value.content.split(/\s+/).filter(Boolean)
        collector.classLoc = {
          start: prop.loc.start.offset,
          end: prop.loc.end.offset,
        }
      }
      // Static style attribute
      if (prop.type === ATTRIBUTE_NODE && prop.name === 'style') {
        if (prop.value) {
          collector.existingStyle = prop.value.content
          collector.styleLoc = {
            start: prop.loc.start.offset,
            end: prop.loc.end.offset,
          }
        }
        else {
          logger.warn(`[vue-template-transform] Found style attr without value at ${prop.loc.start.offset}`)
        }
      }
      // Detect dynamic :style binding (v-bind:style or :style)
      if (prop.type === DIRECTIVE_NODE && prop.name === 'bind' && (prop as any).arg?.content === 'style') {
        collector.hasDynamicStyle = true
      }
      // TODO: Handle dynamic :class bindings (type 7)
    }

    if (collector.classes.length > 0) {
      if (collector.existingStyle && !collector.styleLoc) {
        logger.warn(`[vue-template-transform] BUG: existingStyle found but styleLoc is undefined!`)
      }
      collectors.push(collector)
    }
  })

  if (collectors.length === 0)
    return undefined

  // Apply transforms (reverse order to preserve offsets)
  // Resolve per-element to properly handle gradient class combinations
  let hasChanges = false
  for (const collector of collectors.reverse()) {
    // Resolve this element's classes (includes gradient combination logic)
    const styleMap = await options.resolveStyles(collector.classes)

    // Build inline style from classes
    const styleProps: Record<string, string> = {}
    const unresolvedClasses: string[] = []

    for (const cls of collector.classes) {
      const resolved = styleMap[cls]
      if (resolved && Object.keys(resolved).length > 0) {
        Object.assign(styleProps, resolved)
      }
      else if (!resolved) {
        unresolvedClasses.push(cls)
      }
      // else: resolved but empty (e.g., gradient helper classes) - skip
    }

    // Merge with existing inline style
    if (collector.existingStyle) {
      for (const decl of collector.existingStyle.split(';')) {
        const [prop, ...valParts] = decl.split(':')
        const value = valParts.join(':').trim()
        if (prop?.trim() && value) {
          // Existing style takes precedence
          styleProps[prop.trim()] = value
        }
      }
    }

    // Build final style string (escape quotes to prevent HTML breakage)
    const styleStr = Object.entries(styleProps)
      .map(([prop, value]) => `${prop}: ${escapeAttrValue(value)}`)
      .join('; ')

    const hasResolvedStyles = Object.keys(styleProps).length > 0
    const hasUnresolved = unresolvedClasses.length > 0
    const resolvedSome = unresolvedClasses.length < collector.classes.length

    if (!resolvedSome)
      continue

    if (!collector.classLoc)
      continue

    // If element has :style binding, we can't add inline styles (would cause duplicate)
    // Keep classes intact so Satori's tw prop can handle them at runtime
    if (collector.hasDynamicStyle)
      continue

    hasChanges = true

    if (hasUnresolved) {
      // Keep unresolved classes
      s.overwrite(collector.classLoc.start, collector.classLoc.end, `class="${unresolvedClasses.join(' ')}"`)
    }
    else {
      // Remove class attr entirely
      s.remove(collector.classLoc.start, collector.classLoc.end)
    }

    // Add/update style attribute
    if (hasResolvedStyles) {
      if (collector.styleLoc) {
        s.overwrite(collector.styleLoc.start, collector.styleLoc.end, `style="${styleStr}"`)
      }
      else {
        // BUG CHECK: If element has existingStyle but no styleLoc, we'd create duplicate!
        if (collector.existingStyle) {
          logger.error(`[vue-template-transform] Would create duplicate style! existingStyle="${collector.existingStyle}", classes=[${collector.classes.join(', ')}]`)
        }
        s.appendLeft(collector.classLoc.start, `style="${styleStr}" `)
      }
    }
  }

  if (!hasChanges)
    return undefined

  return {
    code: s.toString(),
    map: s.generateMap({ hires: true }),
  }
}
