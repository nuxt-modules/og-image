import { transform } from 'lightningcss'

const testCss = `
:root {
  --color-red-500: oklch(0.637 0.237 25.331);
  --spacing-4: 1rem;
}

.text-red-500 {
  color: var(--color-red-500);
}

.p-4 {
  padding: var(--spacing-4);
}

.calc-test {
  width: calc(100% - 2rem);
  margin: calc(var(--spacing-4) * 2);
}

.\\32xl\\:text-lg {
  font-size: 1.125rem;
}

.hover\\:bg-blue-500:hover {
  background-color: blue;
}

.m-0\\.5 {
  margin: 0.125rem;
}

.flex .items-center {
  align-items: center;
}
`

console.log('=== Final Lightning CSS approach ===\n')

function extractVars(css: string): Map<string, string> {
  const vars = new Map<string, string>()
  const rootRe = /:(?:root|host)\s*\{([^}]+)\}/g
  for (const match of css.matchAll(rootRe)) {
    const body = match[1]!
    const declRe = /(--[\w-]+)\s*:\s*([^;]+);/g
    for (const m of body.matchAll(declRe)) {
      if (m[1] && m[2])
        vars.set(m[1], m[2].trim())
    }
  }
  return vars
}

function resolveAllVars(css: string, vars: Map<string, string>): string {
  let result = css
  let iterations = 0
  while (result.includes('var(') && iterations < 20) {
    result = result.replace(/var\((--[\w-]+)(?:,\s*([^)]+))?\)/g, (_, name, fallback) => {
      return vars.get(name) ?? fallback ?? ''
    })
    iterations++
  }
  return result
}

function decodeCssSelector(selector: string): string {
  return selector
    .replace(/\\([0-9a-f]+)\s?/gi, (_, hex) => String.fromCodePoint(Number.parseInt(hex, 16)))
    .replace(/\\(.)/g, '$1')
}

/**
 * Check if selector is a simple class (no pseudo-classes, combinators).
 * Must handle CSS escapes like `\32 xl` where space is part of escape.
 */
function isSimpleClassSelector(selector: string): boolean {
  // Remove escape sequences to check for real spaces/combinators
  const withoutEscapes = selector.replace(/\\[0-9a-f]+\s?/gi, '_').replace(/\\./g, '_')

  // Check for combinators (real spaces, >, +, ~)
  if (/[\s>+~]/.test(withoutEscapes))
    return false

  // Check for unescaped pseudo-class (: followed by alpha)
  if (/:[a-z]/i.test(withoutEscapes))
    return false

  return true
}

function extractClasses(css: string): Map<string, Record<string, string>> {
  const classes = new Map<string, Record<string, string>>()

  // Match .selector { body }
  // Selector can contain escapes like \32 (with trailing space)
  const ruleRe = /^\.((?:\\[0-9a-f]+\s?|\\.|[^\s{])+)\s*\{([^}]+)\}/gim

  for (const match of css.matchAll(ruleRe)) {
    const rawSelector = match[1]!
    const body = match[2]!

    if (!isSimpleClassSelector(rawSelector))
      continue

    const className = decodeCssSelector(rawSelector)

    const styles: Record<string, string> = {}
    const declRe = /([\w-]+)\s*:\s*([^;]+);/g
    for (const declMatch of body.matchAll(declRe)) {
      const prop = declMatch[1]!
      const value = declMatch[2]!.trim()
      if (prop.startsWith('--'))
        continue
      styles[prop] = value
    }

    if (Object.keys(styles).length)
      classes.set(className, styles)
  }

  return classes
}

// === Main flow ===

const vars = extractVars(testCss)
console.log('Vars:', Object.fromEntries(vars))

const resolvedCss = resolveAllVars(testCss, vars)

const result = transform({
  filename: 'input.css',
  code: Buffer.from(resolvedCss),
  minify: false,
})
const simplifiedCss = result.code.toString()
console.log('\nSimplified CSS:')
console.log(simplifiedCss)

const classes = extractClasses(simplifiedCss)
console.log('\nExtracted classes:')
for (const [name, styles] of classes) {
  console.log(`  "${name}":`, styles)
}
