import type { H3Event } from 'h3'

export type CloudflareEnv = Record<string, unknown>

function toRecord(value: unknown): Record<string, unknown> | undefined {
  return typeof value === 'object' && value !== null
    ? value as Record<string, unknown>
    : undefined
}

export function getCloudflareEnv(event?: H3Event): CloudflareEnv | undefined {
  const runtimeEnv = toRecord(event?.runtime?.cloudflare?.env)
  if (runtimeEnv)
    return runtimeEnv

  const contextCloudflare = toRecord(event?.context.cloudflare)
  const contextEnv = toRecord(contextCloudflare?.env)
  if (contextEnv)
    return contextEnv

  const platform = toRecord(event?.context._platform)
  const platformCloudflare = toRecord(platform?.cloudflare)
  return toRecord(platformCloudflare?.env)
}
