import type { H3Event } from 'h3'
import { describe, expect, it } from 'vitest'
import { getCloudflareEnv } from '../../src/runtime/server/util/cloudflare'

function createEvent(input: {
  runtimeEnv?: Record<string, unknown>
  context?: Record<string, unknown>
}): H3Event {
  return {
    context: input.context || {},
    runtime: input.runtimeEnv
      ? { cloudflare: { env: input.runtimeEnv } }
      : undefined,
  } as H3Event
}

describe('getCloudflareEnv', () => {
  it('reads the H3 runtime context', () => {
    const env = { SOURCE: 'runtime' }
    const event = createEvent({ runtimeEnv: env })

    expect(getCloudflareEnv(event)).toBe(env)
  })

  it('reads Nitro direct context', () => {
    const env = { SOURCE: 'direct' }
    const event = createEvent({ context: { cloudflare: { env } } })

    expect(getCloudflareEnv(event)).toBe(env)
  })

  it('reads Nitro platform context', () => {
    const env = { SOURCE: 'platform' }
    const event = createEvent({
      context: {
        _platform: {
          cloudflare: { env },
        },
      },
    })

    expect(getCloudflareEnv(event)).toBe(env)
  })

  it('prefers the H3 runtime context', () => {
    const runtimeEnv = { SOURCE: 'runtime' }
    const event = createEvent({
      runtimeEnv,
      context: {
        cloudflare: {
          env: { SOURCE: 'direct' },
        },
      },
    })

    expect(getCloudflareEnv(event)).toBe(runtimeEnv)
  })
})
