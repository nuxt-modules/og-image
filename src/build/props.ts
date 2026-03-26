/**
 * Extract prop names from a Vue SFC's `defineProps` declaration.
 *
 * Supports all three Vue syntaxes:
 * 1. TypeScript generic: `defineProps<{ title: string, desc?: string }>()`
 * 2. Runtime object:     `defineProps({ title: String, desc: { type: String } })`
 * 3. Array shorthand:    `defineProps(['title', 'desc'])`
 *
 * Operates on raw source text (no AST parser needed).
 */

const RE_SCRIPT_SETUP = /<script\s[^>]*setup[^>]*>([\s\S]*?)<\/script>/

// Match top-level keys in a TS interface/object type literal: `{ title: string, desc?: number }`
const RE_TS_PROP_KEY = /(?:^|[;,\n}])\s*(\w+)\s*(?:\?\s*)?:/g

// Match top-level keys in a runtime object: `{ title: String, desc: { type: Number } }`
const RE_RUNTIME_PROP_KEY = /(?:^|[,\n}])\s*(\w+)\s*:/g

// Match array items: `['title', 'desc']` or `["title", "desc"]`
const RE_ARRAY_ITEM = /['"](\w+)['"]/g

function findBalanced(source: string, openChar: string, closeChar: string, startIndex: number): string | null {
  let depth = 0
  let start = -1
  for (let i = startIndex; i < source.length; i++) {
    if (source[i] === openChar) {
      if (depth === 0)
        start = i + 1
      depth++
    }
    else if (source[i] === closeChar) {
      depth--
      if (depth === 0 && start !== -1)
        return source.slice(start, i)
    }
  }
  return null
}

export function extractPropNamesFromVue(code: string): string[] {
  const match = RE_SCRIPT_SETUP.exec(code)
  if (!match)
    return []

  const src = match[1]

  const dpIndex = src.indexOf('defineProps')
  if (dpIndex === -1)
    return []

  // Check for TypeScript generic syntax: defineProps<...>()
  const afterDp = src.slice(dpIndex + 'defineProps'.length).trimStart()
  if (afterDp.startsWith('<')) {
    const typeBody = findBalanced(src, '<', '>', dpIndex + 'defineProps'.length)
    if (typeBody)
      return extractTopLevelKeys(typeBody, RE_TS_PROP_KEY)
  }

  // Check for runtime object or array syntax: defineProps({...}) or defineProps([...])
  const parenContent = findBalanced(src, '(', ')', dpIndex + 'defineProps'.length)
  if (!parenContent)
    return []

  const trimmed = parenContent.trim()

  // Array syntax: defineProps(['title', 'desc'])
  if (trimmed.startsWith('[')) {
    const names: string[] = []
    let m: RegExpExecArray | null
    // eslint-disable-next-line no-cond-assign
    while (m = RE_ARRAY_ITEM.exec(trimmed))
      names.push(m[1])
    RE_ARRAY_ITEM.lastIndex = 0
    return names
  }

  // Runtime object syntax: defineProps({ title: String })
  if (trimmed.startsWith('{'))
    return extractTopLevelKeys(trimmed, RE_RUNTIME_PROP_KEY)

  return []
}

/**
 * Extract top-level property keys from a braced block, skipping nested braces.
 */
function extractTopLevelKeys(body: string, re: RegExp): string[] {
  const keys: string[] = []
  let depth = 0
  let flat = ''

  for (const ch of body) {
    if (ch === '{' || ch === '<' || ch === '(') {
      depth++
      if (depth > 1) {
        flat += ' '
        continue
      }
    }
    else if (ch === '}' || ch === '>' || ch === ')') {
      if (depth > 1) {
        flat += ' '
        depth--
        continue
      }
      depth--
    }
    flat += depth <= 1 ? ch : ' '
  }

  let m: RegExpExecArray | null
  // eslint-disable-next-line no-cond-assign
  while (m = re.exec(flat))
    keys.push(m[1])
  re.lastIndex = 0
  return keys
}
