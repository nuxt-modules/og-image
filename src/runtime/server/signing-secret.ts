import type { RequestEvent } from 'nuxt/server'
import type { OgImageRuntimeConfig } from '../types'
import { createError, deriveSecret, useRuntimeConfig } from 'nuxt/server'
import { getCloudflareEnv } from './util/cloudflare'

export const OG_IMAGE_SECRET_PURPOSE = 'nuxt-og-image:url-signing'

// Nitro in-process requests (internal $fetch, islands via global fetch) re-enter
// middleware as synthetic events without Worker context. Remember the derived
// secret for the isolate once a Cloudflare root has been observed.
let observed: { root: unknown, configRoot: unknown, secret: string } | undefined

/** Resolve once per request before synchronous app and server URL helpers run. */
export async function initializeOgImageSigning(event: Pick<RequestEvent, 'context'>): Promise<void> {
  const config = useRuntimeConfig()
  const security = (config['nuxt-og-image'] as unknown as OgImageRuntimeConfig).security
  if (security.secret === false || (import.meta.prerender && !security.strict))
    return

  const cloudflareEnv = getCloudflareEnv(event)
  const configRoot = config.appSecret
  if (cloudflareEnv !== undefined) {
    const root = cloudflareEnv.NUXT_APP_SECRET === undefined ? configRoot : cloudflareEnv.NUXT_APP_SECRET
    // Nuxt 4.6's deriveSecret has no event argument. Nitro 2's shared config
    // cannot see Worker bindings, so use the same HKDF for an event-bound root.
    const secret = observed !== undefined && observed.root === root
      ? observed.secret
      : root === configRoot
        ? await deriveSecret(OG_IMAGE_SECRET_PURPOSE)
        : await deriveCloudflareSecret(root)
    observed = { root, configRoot, secret }
    event.context._ogImageSigningSecret = secret
    return
  }
  if (observed !== undefined && configRoot === observed.configRoot) {
    // Synthetic events carry no Worker context, so the only observable root is
    // the one this isolate already served. Nitro 2's event-less runtime config
    // cannot see binding overrides. Keep the observed key while the shared
    // configuration is unchanged. Real Worker requests always resolve their
    // current env above, so invalid roots cannot reuse a previous valid key.
    event.context._ogImageSigningSecret = observed.secret
    return
  }
  event.context._ogImageSigningSecret = await deriveSecret(OG_IMAGE_SECRET_PURPOSE)
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
