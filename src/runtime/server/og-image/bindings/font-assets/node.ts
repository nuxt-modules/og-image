import type { H3Event } from 'h3'
import type { FontConfig } from '../../../../types'
import { useRuntimeConfig } from 'nitropack/runtime'
import { withBase } from 'ufo'
import { getNitroOrigin, getSiteConfig } from '#site-config/server/composables'
import { getFetchTimeout } from '../../../util/fetchTimeout'
import { fetchWithRedirectValidation } from '../../../util/ssrf'
import { useOgImageRuntimeConfig } from '../../../utils'
import { fetchSpecialFontUrl, isDataFontUrl, isExternalFontUrl } from './external-url'

export async function resolve(event: H3Event, font: FontConfig) {
  const path = font.src || font.localPath
  const runtimeConfig = useOgImageRuntimeConfig()
  const timeout = getFetchTimeout(runtimeConfig)
  const { app } = useRuntimeConfig()
  const origin = getNitroOrigin(event)
  const fullPath = withBase(path, app.baseURL)

  // `data:` and external font URLs are attacker-reachable via the `fonts` URL
  // param (GHSA-q8hw-4fvp-9rwv). `data:` is decoded inline; external URLs are
  // unsupported (use @nuxt/fonts) except the site's own origin, fetched through
  // the SSRF guard. Classification is canonicalized so crafted paths like
  // " //127.0.0.1" can't slip past as relative into the raw fetch below.
  if (path && (isDataFontUrl(path) || isExternalFontUrl(path)))
    return fetchSpecialFontUrl(path, getSiteConfig(event).url, timeout)

  // Same-origin asset fetch. `trustedHost` exempts our own origin from the
  // block classifier (it may be loopback behind a proxy) while still
  // re-validating any redirect that leaves the origin — so an open redirect on
  // the app can't bounce the font fetch to an internal target (GHSA-q8hw-4fvp-9rwv).
  const target = new URL(fullPath, origin)
  const ab = await fetchWithRedirectValidation(target.href, { timeout, trustedHost: target.host }).catch(() => null)
  if (ab) {
    return Buffer.from(ab)
  }
  // Fallback to Nitro's internal handler when origin is unreachable
  // (behind a proxy, serverless, or server not fully started)
  const fetchArrayBuffer = event.$fetch as unknown as (path: string, options: { responseType: 'arrayBuffer', timeout: number }) => Promise<ArrayBuffer>
  const arrayBuffer = await fetchArrayBuffer(fullPath, {
    responseType: 'arrayBuffer',
    timeout,
  })
  return Buffer.from(arrayBuffer)
}
