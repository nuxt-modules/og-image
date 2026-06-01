import { describe, expect, it } from 'vitest'
import { canPromptInteractively } from '../../src/utils/dependencies'

describe('canPromptInteractively', () => {
  it('prompts only in a real interactive terminal', () => {
    expect(canPromptInteractively({ hasTTY: true, isAgent: false, isCI: false })).toBe(true)
  })

  it('does not prompt when there is no TTY', () => {
    expect(canPromptInteractively({ hasTTY: false, isAgent: false, isCI: false })).toBe(false)
  })

  it('does not prompt when running as an AI agent', () => {
    // even with a TTY, agents have no human to answer the prompt
    expect(canPromptInteractively({ hasTTY: true, isAgent: true, isCI: false })).toBe(false)
  })

  it('does not prompt in CI', () => {
    expect(canPromptInteractively({ hasTTY: true, isAgent: false, isCI: true })).toBe(false)
  })
})
