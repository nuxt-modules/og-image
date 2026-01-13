import type { ElementNode, TemplateChildNode } from '@vue/compiler-core'
import { parse as parseSfc } from '@vue/compiler-sfc'
import MagicString from 'magic-string'

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
}

const ELEMENT_NODE = 1
const ATTRIBUTE_NODE = 6
// const DIRECTIVE_NODE = 7

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
  walkAst(descriptor.template.ast.children, (node) => {
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
      if (prop.type === ATTRIBUTE_NODE && prop.name === 'style' && prop.value) {
        collector.existingStyle = prop.value.content
        collector.styleLoc = {
          start: prop.loc.start.offset,
          end: prop.loc.end.offset,
        }
      }
      // TODO: Handle dynamic :class and :style bindings (type 7)
    }

    if (collector.classes.length > 0) {
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
        const [prop, value] = decl.split(':').map(s => s.trim())
        if (prop && value) {
          // Existing style takes precedence
          styleProps[prop] = value
        }
      }
    }

    // Build final style string (escape quotes to prevent HTML breakage)
    const styleStr = Object.entries(styleProps)
      .map(([prop, value]) => `${prop}: ${escapeAttrValue(value)}`)
      .join('; ')

    if (Object.keys(styleProps).length > 0 || unresolvedClasses.length !== collector.classes.length) {
      hasChanges = true

      // Remove existing class attribute if we resolved everything
      if (unresolvedClasses.length === 0 && collector.classLoc) {
        // Remove class attr, add/update style
        s.remove(collector.classLoc.start, collector.classLoc.end)

        if (collector.styleLoc) {
          // Update existing style
          s.overwrite(collector.styleLoc.start, collector.styleLoc.end, `style="${styleStr}"`)
        }
        else {
          // Insert style after the removed class location
          // We need to find where to insert - after tag name
          s.appendLeft(collector.classLoc.start, `style="${styleStr}" `)
        }
      }
      else if (unresolvedClasses.length > 0 && collector.classLoc) {
        // Keep unresolved classes, add resolved as style
        s.overwrite(
          collector.classLoc.start,
          collector.classLoc.end,
          `class="${unresolvedClasses.join(' ')}"`,
        )

        if (styleStr) {
          if (collector.styleLoc) {
            s.overwrite(collector.styleLoc.start, collector.styleLoc.end, `style="${styleStr}"`)
          }
          else {
            s.appendLeft(collector.classLoc.start, `style="${styleStr}" `)
          }
        }
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

function walkAst(
  nodes: TemplateChildNode[],
  visitor: (node: TemplateChildNode) => void,
) {
  for (const node of nodes) {
    visitor(node)
    if ('children' in node && Array.isArray(node.children)) {
      walkAst(node.children as TemplateChildNode[], visitor)
    }
  }
}
