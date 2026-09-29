import { describe, expect, it } from 'vitest'
import { canPromptInteractively, resolveMissingRendererAction } from '../../src/utils/dependencies'

const base = { renderer: 'takumi' as const, installSpecs: ['@takumi-rs/core'] }

describe('resolveMissingRendererAction', () => {
  it('asks before it installs in an interactive dev session', () => {
    expect(resolveMissingRendererAction({ ...base, dev: true, interactive: true })._tag).toBe('AskToInstall')
  })

  it('never installs in a non-interactive dev session, and names the command', () => {
    const action = resolveMissingRendererAction({ ...base, dev: true, interactive: false })
    expect(action).toMatchObject({ _tag: 'Report' })
    expect(action._tag !== 'AskToInstall' && action.message).toContain('npx nypm add @takumi-rs/core')
  })

  it('fails a production build, interactive or not', () => {
    for (const interactive of [true, false]) {
      const action = resolveMissingRendererAction({ ...base, dev: false, interactive })
      expect(action).toMatchObject({ _tag: 'Fail' })
      expect(action._tag !== 'AskToInstall' && action.message).toContain('npx nypm add @takumi-rs/core')
    }
  })

  it('treats an agent shell and a piped shell the same way', () => {
    const agent = canPromptInteractively({ hasTTY: true, hasStdinTTY: true, isAgent: true, isCI: false })
    const piped = canPromptInteractively({ hasTTY: true, hasStdinTTY: false, isAgent: false, isCI: false })
    expect(resolveMissingRendererAction({ ...base, dev: true, interactive: agent }))
      .toEqual(resolveMissingRendererAction({ ...base, dev: true, interactive: piped }))
  })
})
