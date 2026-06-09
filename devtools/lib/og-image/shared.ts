// Vendored from nuxt-og-image src/runtime/shared.ts — only the runtime helpers the
// devtools panel needs (separateProps + a re-export of encodeOgImageParams). Kept local
// so the shipped layer has no dependency on the module's src.
import { defu } from 'defu'

export { encodeOgImageParams } from './shared/urlEncoding'

const RE_KEBAB_CASE = /-([a-z])/g
const OG_IMAGE_OPTION_KEYS: string[] = ['url', 'extension', 'width', 'height', 'alt', 'props', 'renderer', 'component', 'emojis', '_query', '_hash', 'fonts', 'satori', 'resvg', 'sharp', 'screenshot', 'takumi', 'cacheMaxAgeSeconds', 'cacheKey', 'key']

function filterIsOgImageOption(key: string): boolean {
  return OG_IMAGE_OPTION_KEYS.includes(key)
}

export function separateProps(options: any | undefined, ignoreKeys: string[] = []): any {
  options = options || {}
  const _props = defu(options.props as Record<string, any>, Object.fromEntries(
    Object.entries({ ...options }).filter(([k]) => !filterIsOgImageOption(k) && !ignoreKeys.includes(k)),
  ))
  const props: Record<string, any> = {}
  Object.entries(_props).forEach(([key, val]) => {
    props[key.replace(RE_KEBAB_CASE, g => String(g[1]).toUpperCase())] = val
  })
  const result: Record<string, any> = Object.fromEntries(
    Object.entries({ ...options }).filter(([k]) => filterIsOgImageOption(k) || ignoreKeys.includes(k)),
  )
  if (Object.keys(props).length > 0)
    result.props = props
  return result
}
