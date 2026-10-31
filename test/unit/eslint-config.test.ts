import { ESLint } from 'eslint'
import { describe, expect, it } from 'vitest'

describe('repository lint configuration', () => {
  it('accepts existing compact expressions after dependency updates', async () => {
    const results = await new ESLint().lintFiles(['test/unplugin.ts'])

    expect(results.flatMap(result => result.messages.filter(message => message.severity === 2))).toEqual([])
  })

  it('still rejects undefined identifiers', async () => {
    const results = await new ESLint().lintText('missingFunction()\n', { filePath: 'lint-regression.js' })

    expect(results.flatMap(result => result.messages)).toContainEqual(expect.objectContaining({
      ruleId: 'no-undef',
      severity: 2,
    }))
  })
})
