import type { Ref } from 'vue'
import type { OgImageOptions } from '../../types'
import { defineOgImageRaw } from './_defineOgImageRaw'

export interface OgImageUrlOptions extends OgImageOptions {
}

/**
 * Define an OG image using a pre-prepared image URL.
 *
 * Use this when you have an existing image and don't need to generate one.
 *
 * @param url - The URL to the image (absolute or relative)
 * @param options - Additional options (width, height, alt, etc.)
 */
export function defineOgImageUrl(
  url: string | (() => string) | Ref<string>,
  options: OgImageUrlOptions = {},
): string[] {
  return defineOgImageRaw({
    ...options,
    url,
  })
}
