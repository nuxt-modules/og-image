import type { Storage } from 'unstorage'
import type { ResolvedFontConfig } from './runtime/types'
import { resolvePath } from '@nuxt/kit'
import { Launcher } from 'chrome-launcher'
import { $fetch } from 'ofetch'
import { isCI } from 'std-env'

export const isUndefinedOrTruthy = (v?: any) => typeof v === 'undefined' || v !== false

export function checkLocalChrome() {
  // quick path for CI
  if (isCI)
    return false

  let hasChromeLocally = false
  try {
    hasChromeLocally = !!Launcher.getFirstInstallation()
  }
  catch {}
  return hasChromeLocally
}

export async function hasResolvableDependency(dep: string) {
  return await resolvePath(dep, { fallbackToOriginal: true })
    .catch(() => null)
    .then(r => r && r !== dep)
}

export async function downloadFont(font: ResolvedFontConfig, storage: Storage, mirror?: true | string) {
  const { name, weight, style } = font
  const key = `${name}-${style}-${weight}.ttf.base64`
  if (await storage.hasItem(key))
    return { success: true }

  const host = typeof mirror === 'undefined' ? 'fonts.googleapis.com' : mirror === true ? 'fonts.font.im' : mirror
  const cssUrl = `https://${host}/css2?family=${name}:${style === 'ital' ? `ital,wght@1,${weight}` : `wght@${weight}`}`

  // using H3Event $fetch will cause the request headers not to be sent
  const css = await $fetch(cssUrl, {
    timeout: 10 * 1000, // 10 second timeout
    headers: {
      // Make sure it returns TTF.
      'User-Agent':
        'Mozilla/5.0 (Macintosh; U; Intel Mac OS X 10_6_8; de-at) AppleWebKit/533.21.1 (KHTML, like Gecko) Version/5.0.5 Safari/533.21.1',
    },
  }).catch((err) => {
    return { error: err }
  })
  if (!css || typeof css !== 'string')
    return { success: false, error: css?.error || new Error(`Failed to fetch CSS from ${cssUrl}`), host }

  const ttfResource = css.match(/src: url\((.+)\) format\('(opentype|truetype)'\)/)
  if (ttfResource?.[1]) {
    const buf = await $fetch(ttfResource[1], { responseType: 'arrayBuffer' }).catch((err) => {
      return { error: err }
    })
    if (buf?.error)
      return { success: false, error: buf.error, host, fontUrl: ttfResource[1] }

    // need to base 64 the buf
    const base64Font = Buffer.from(buf as ArrayBuffer).toString('base64')
    // output to outputPath
    await storage.setItem(key, base64Font)
    return { success: true }
  }
  return { success: false, error: new Error('No TTF resource found in CSS response'), host }
}
