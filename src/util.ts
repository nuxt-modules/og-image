import { tryResolveModule } from '@nuxt/kit'
import { Launcher } from 'chrome-launcher'
import { $fetch } from 'ofetch'
import { isCI } from 'std-env'
import type { Storage } from 'unstorage'
import type { ResolvedFontConfig } from './runtime/types'

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

export async function checkPlaywrightDependency() {
  return !!(await tryResolveModule('playwright'))
}

export async function downloadFont(font: ResolvedFontConfig, storage: Storage, mirror?: true | string) {
  const { name, weight } = font
  const key = `${name}-${weight}.ttf.base64`
  if (await storage.hasItem(key))
    return true

  const host = typeof mirror === 'undefined' ? 'fonts.googleapis.com' : mirror === true ? 'fonts.font.im' : mirror
  // using H3Event $fetch will cause the request headers not to be sent
  const css = await $fetch(`https://${host}/css2?family=${name}:wght@${weight}`, {
    timeout: 10 * 1000, // 10 second timeout
    headers: {
      // Make sure it returns TTF.
      'User-Agent':
        'Mozilla/5.0 (Macintosh; U; Intel Mac OS X 10_6_8; de-at) AppleWebKit/533.21.1 (KHTML, like Gecko) Version/5.0.5 Safari/533.21.1',
    },
  }).catch(() => {
    return false
  })
  if (!css)
    return false

  const ttfResource = css.match(/src: url\((.+)\) format\('(opentype|truetype)'\)/)
  if (ttfResource?.[1]) {
    const buf = await $fetch(ttfResource[1], { baseURL: host, responseType: 'arrayBuffer' })
    // need to base 64 the buf
    const base64Font = Buffer.from(buf).toString('base64')
    // output to outputPath
    await storage.setItem(key, base64Font)
    return true
  }
  return false
}
