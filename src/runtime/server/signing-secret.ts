import type { RequestEvent } from 'nuxt/server'
import type { OgImageRuntimeConfig } from '../types'
import { createError, deriveSecret, useRuntimeConfig } from 'nuxt/server'
import { getCloudflareEnv } from './util/cloudflare'

export const OG_IMAGE_SECRET_PURPOSE = 'nuxt-og-image:url-signing'

/** Resolve once per request before synchronous app and server URL helpers run. */
export async function initializeOgImageSigning(event: Pick<RequestEvent, 'context'>): Promise<void> {
  const config = useRuntimeConfig()
  const security = (config['nuxt-og-image'] as unknown as OgImageRuntimeConfig).security
  if (security.secret === false || (import.meta.prerender && !security.strict))
    return

  const cloudflareRoot = getCloudflareEnv(event)?.NUXT_APP_SECRET
  // Nuxt 4.6's deriveSecret has no event argument. Nitro 2's shared config
  // cannot see Worker bindings, so use the same HKDF for an event-bound root.
  const secret = cloudflareRoot !== undefined && cloudflareRoot !== config.appSecret
    ? await deriveCloudflareSecret(cloudflareRoot)
    : await deriveSecret(OG_IMAGE_SECRET_PURPOSE)
  event.context._ogImageSigningSecret = secret
}

async function deriveCloudflareSecret(root: unknown): Promise<string> {
  if (typeof root !== 'string' || root.length < 32) {
    throw createError({ status: 500, message: 'Set NUXT_APP_SECRET to a string with at least 32 characters.' })
  }
  const encoder = new TextEncoder()
  const key = await crypto.subtle.importKey('raw', encoder.encode(root), 'HKDF', false, ['deriveBits'])
  const bits = await crypto.subtle.deriveBits({
    name: 'HKDF',
    hash: 'SHA-256',
    salt: encoder.encode('nuxt'),
    info: encoder.encode(OG_IMAGE_SECRET_PURPOSE),
  }, key, 256)
  return Array.from(new Uint8Array(bits), byte => byte.toString(16).padStart(2, '0')).join('')
}
