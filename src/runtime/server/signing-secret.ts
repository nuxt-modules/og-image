import type { RequestEvent } from 'nuxt/server'
import type { OgImageRuntimeConfig } from '../types'
import { createError, deriveSecret, useRuntimeConfig } from 'nuxt/server'
import { joinURL } from 'ufo'
import { getCloudflareEnv } from './util/cloudflare'

export const OG_IMAGE_SECRET_PURPOSE = 'nuxt-og-image:url-signing'

// Nitro in-process requests (internal $fetch, islands via global fetch) re-enter
// middleware as synthetic events without Worker context. Remember the derived
// secret for the isolate once a Cloudflare root has been observed.
let observed: { root: unknown, configRoot: unknown, secret: string } | undefined
let derivation: { root: string, mode: 'nuxt' | 'binding', promise: Promise<string> } | undefined

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
      : await getSigningSecret(root, root === configRoot ? 'nuxt' : 'binding')
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
  event.context._ogImageSigningSecret = await getSigningSecret(configRoot, 'nuxt')
}

function getSigningSecret(root: unknown, mode: 'nuxt' | 'binding'): Promise<string> {
  // Invalid roots must reach the validator instead of reusing a previous key.
  if (typeof root !== 'string' || root.length < 32)
    return mode === 'nuxt' ? deriveSecret(OG_IMAGE_SECRET_PURPOSE) : deriveRootSecret(root)
  if (derivation?.root === root && derivation.mode === mode)
    return derivation.promise
  // Invoke immediately: Nuxt reads the current root before its first await.
  // Keep only one root, including pending work, separately from the Worker bridge.
  const promise = mode === 'nuxt' ? deriveSecret(OG_IMAGE_SECRET_PURPOSE) : deriveRootSecret(root)
  const entry = { root, mode, promise }
  derivation = entry
  entry.promise = promise.catch((error: unknown) => {
    if (derivation === entry)
      derivation = undefined
    throw error
  })
  return entry.promise
}

/** Only the image endpoints need the secret. Every other request can render without it. */
export function isOgImageEndpointPath(pathname: string, baseURL: string): boolean {
  return pathname.startsWith('/_og/') || pathname.startsWith(joinURL(baseURL, '_og/'))
}

let reportedFailure = false

/** Log a missing or invalid secret once per server instance, with the fix. */
export function reportSigningFailure(failure: unknown): void {
  if (reportedFailure)
    return
  reportedFailure = true
  const cause = failure instanceof Error ? failure.message : String(failure)
  console.error([
    '[nuxt-og-image] URL signing has no valid secret. OG image requests return 500 until you fix this. Pages still render.',
    'Set NUXT_APP_SECRET in production. Generate it with openssl rand -base64 32.',
    'The secret must have at least 32 characters. To turn off signing, set `ogImage.security.secret` to false.',
    `Cause: ${cause}`,
  ].join('\n'))
}

async function deriveRootSecret(root: unknown): Promise<string> {
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
