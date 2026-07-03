import type { OxcParseSync } from './oxc-parser'

export interface AstNode {
  type: string
  start: number
  end: number
  [key: string]: any
}

interface ParseAndWalkOptions {
  parseSync: OxcParseSync
  enter?: (node: AstNode) => void
}

const RE_JS_TS_LANG = /\.[cm]?(js|jsx|ts|tsx)$/

function isAstNode(value: unknown): value is AstNode {
  return Boolean(value && typeof value === 'object' && typeof (value as AstNode).type === 'string')
}

export function parseAndWalk(code: string, sourceFilename: string, options: ParseAndWalkOptions): unknown {
  const lang = sourceFilename.match(RE_JS_TS_LANG)?.[1]
  const ast = options.parseSync(sourceFilename, code, {
    sourceType: 'module',
    lang,
  })
  walkAst(ast.program, options.enter)
  return ast
}

function walkAst(node: AstNode | undefined, enter?: (node: AstNode) => void): void {
  if (!node)
    return

  enter?.(node)

  for (const key in node) {
    const value = node[key]
    if (!value || typeof value !== 'object')
      continue

    if (Array.isArray(value)) {
      for (const child of value) {
        if (isAstNode(child))
          walkAst(child, enter)
      }
    }
    else if (isAstNode(value)) {
      walkAst(value, enter)
    }
  }
}
