import type { H3Event } from 'h3'
import type { FontConfig } from '../../../../types'
import { useRuntimeConfig } from 'nitropack/runtime'
import { withBase } from 'ufo'
import { getNitroOrigin } from '#site-config/server/composables'
import { getFetchTimeout } from '../../../util/fetchTimeout'
import { fetchWithRedirectValidation } from '../../../util/ssrf'
import { useOgImageRuntimeConfig } from '../../../utils'
import { fetchExternalFont, isExternalFontUrl } from './external-url'

export async function resolve(event: H3Event, font: FontConfig) {
  const path = font.src || font.localPath
  const runtimeConfig = useOgImageRuntimeConfig()
  const timeout = getFetchTimeout(runtimeConfig)
  const { app } = useRuntimeConfig()
  const origin = getNitroOrigin(event)
  const fullPath = withBase(path, app.baseURL)

  // External font URLs are attacker-reachable via the `fonts` URL param
  // (GHSA-q8hw-4fvp-9rwv). Classification is canonicalized so crafted paths
  // like " //127.0.0.1" can't slip past as relative; the resolved URL is then
  // routed through the SSRF guard (default-deny + allowlist) instead of the raw
  // origin-anchored fetch below, which `new URL(absolute, origin)` would escape.
  if (path && isExternalFontUrl(path)) {
    const href = new URL(fullPath, origin).href
    return fetchExternalFont(href, timeout, runtimeConfig.security?.fontHostAllowlist ?? [])
  }

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
