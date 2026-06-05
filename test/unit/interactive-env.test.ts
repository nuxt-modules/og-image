import { describe, expect, it } from 'vitest'
import { canPromptInteractively } from '../../src/utils/dependencies'

describe('canPromptInteractively', () => {
  it('prompts only in a real interactive terminal', () => {
    expect(canPromptInteractively({ hasTTY: true, hasStdinTTY: true, isAgent: false, isCI: false })).toBe(true)
  })

  it('does not prompt when stdout is not a TTY', () => {
    expect(canPromptInteractively({ hasTTY: false, hasStdinTTY: true, isAgent: false, isCI: false })).toBe(false)
  })

  it('does not prompt when stdin is not a TTY', () => {
    // e.g. `nuxt dev < /dev/null` or a piped stdin: output looks interactive but no answer can arrive
    expect(canPromptInteractively({ hasTTY: true, hasStdinTTY: false, isAgent: false, isCI: false })).toBe(false)
  })

  it('does not prompt when running as an AI agent', () => {
    // even with a TTY, agents have no human to answer the prompt
    expect(canPromptInteractively({ hasTTY: true, hasStdinTTY: true, isAgent: true, isCI: false })).toBe(false)
  })

  it('does not prompt in CI', () => {
    expect(canPromptInteractively({ hasTTY: true, hasStdinTTY: true, isAgent: false, isCI: true })).toBe(false)
  })
})
