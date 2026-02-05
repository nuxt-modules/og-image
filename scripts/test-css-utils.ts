import { extractCssVars, resolveCssVars, simplifyCss, extractClassStyles, processCss } from '../src/build/css/css-utils'

const testCss = `
:root {
  --color-red-500: oklch(0.637 0.237 25.331);
  --spacing-4: 1rem;
  --color-primary-500: #22c55e;
}

.text-red-500 {
  color: var(--color-red-500);
}

.p-4 {
  padding: var(--spacing-4);
}

.bg-primary-500 {
  background-color: var(--color-primary-500);
}

.calc-test {
  width: calc(100% - 2rem);
  margin: calc(var(--spacing-4) * 2);
}

.\\32xl\\:text-lg {
  font-size: 1.125rem;
}

.m-0\\.5 {
  margin: 0.125rem;
}
`

async function main() {
  console.log('=== Testing CSS Utils ===\n')

  // Test 1: Extract vars
  console.log('1. Extract CSS vars:')
  const vars = extractCssVars(testCss)
  console.log('  Vars:', Object.fromEntries(vars))
  console.log()

  // Test 2: Resolve vars
  console.log('2. Resolve CSS vars:')
  const resolved = resolveCssVars(testCss, vars)
  console.log('  After resolution (snippet):')
  console.log(resolved.slice(0, 500))
  console.log()

  // Test 3: Simplify CSS
  console.log('3. Simplify CSS with Lightning CSS:')
  const simplified = await simplifyCss(resolved)
  console.log('  Simplified (snippet):')
  console.log(simplified.slice(0, 500))
  console.log()

  // Test 4: Extract class styles
  console.log('4. Extract class styles:')
  const classes = extractClassStyles(simplified)
  console.log('  Classes:')
  for (const [name, styles] of classes) {
    console.log(`    "${name}":`, styles)
  }
  console.log()

  // Test 5: Full pipeline
  console.log('5. Full processCss pipeline:')
  const result = await processCss(testCss)
  console.log('  Final classes:')
  for (const [name, styles] of result.classes) {
    console.log(`    "${name}":`, styles)
  }
}

main().catch(console.error)
