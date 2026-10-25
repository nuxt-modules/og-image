import { describe, expect, it } from 'vitest'
import { resolveCssVars, resolveVarsDeep } from '../../src/build/css/css-utils'

// The variable map is flat, so a design system that re-declares a variable in a nested
// scope (`--outer: var(--row)` on the parent, `--row: calc(var(--outer) - ...)` inside)
// reads as a cycle even though the CSS is valid.
function scopedAliasVars(): Map<string, string> {
  return new Map([
    ['--row', 'calc(var(--outer) - var(--guide) - var(--pad) - 1px)'],
    ['--outer', 'var(--row)'],
    ['--guide', 'calc(0.625rem + 1.25rem / 2)'],
    ['--pad', 'calc(1.25rem / 2 + 0.75rem - 0.625rem - 1px)'],
  ])
}

describe('css var cycles', () => {
  it('leaves the reference that closes a cycle in place instead of unrolling it', () => {
    expect(resolveCssVars('var(--row)', scopedAliasVars()))
      .toBe('calc(var(--row) - calc(0.625rem + 1.25rem / 2) - calc(1.25rem / 2 + 0.75rem - 0.625rem - 1px) - 1px)')
  })

  // Before the fix every pass of resolveVarsDeep unrolled the cycle again; the nested calc()
  // it built made Lightning CSS run for minutes, so this would time out rather than fail.
  it('does not re-expand a cut cycle across deep-resolution passes', async () => {
    const resolved = await resolveVarsDeep('var(--row)', scopedAliasVars())
    expect(resolved.match(/var\(--row\)/g)).toHaveLength(1)
    // One level: --row's own calc() and its two calc() terms, which the var() keeps unsimplified.
    expect(resolved.match(/calc\(/g)).toHaveLength(3)
  }, 5000)

  it('treats a self-referencing variable as unset inside its own value', () => {
    const vars = new Map([['--self', 'calc(var(--self, 2px) + 1px)']])
    expect(resolveCssVars('var(--self)', vars)).toBe('calc(2px + 1px)')
  })

  it('still expands a variable used twice side by side', () => {
    const vars = new Map([['--pair', 'var(--one) var(--one)'], ['--one', '1px']])
    expect(resolveCssVars('var(--pair)', vars)).toBe('1px 1px')
  })

  it('resolves a long acyclic chain, continuing past the per-pass budget', async () => {
    const vars = new Map<string, string>()
    for (let i = 0; i < 150; i++)
      vars.set(`--v${i}`, `var(--v${i + 1})`)
    vars.set('--v150', '4px')
    expect(await resolveVarsDeep('var(--v0)', vars)).toBe('4px')
  })
})
