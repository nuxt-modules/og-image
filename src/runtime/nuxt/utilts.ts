import type { Head } from '@unhead/schema'
import type { OgImageOptions, OgImagePrebuilt } from '../types'
import { useServerHead } from '#imports'

export function createOgImageMeta(src: string | null, input: OgImageOptions | OgImagePrebuilt, resolvedOptions: OgImageOptions, ssrContext: Record<string, any>) {
  const url = src || input.url
  let urlExtension = (url.split('/').pop() || url).split('.').pop() || resolvedOptions.extension
  if (urlExtension === 'jpg')
    urlExtension = 'jpeg'
  const meta: Head['meta'] = [
    { property: 'og:image', content: resolvedOptions.url },
    { property: 'og:image:type', content: `image/${urlExtension}` },
    { name: 'twitter:card', content: 'summary_large_image' },
    { name: 'twitter:image:src', content: resolvedOptions.url },
  ]
  if (resolvedOptions.width) {
    meta.push({ property: 'og:image:width', content: resolvedOptions.width })
    meta.push({ name: 'twitter:image:width', content: resolvedOptions.width })
  }
  if (resolvedOptions.height) {
    meta.push({ property: 'og:image:height', content: resolvedOptions.height })
    meta.push({ name: 'twitter:image:height', content: resolvedOptions.height })
  }
  if (resolvedOptions.alt) {
    meta.push({ property: 'og:image:alt', content: resolvedOptions.alt })
    meta.push({ name: 'twitter:image:alt', content: resolvedOptions.alt })
  }
  ssrContext._ogImageInstances = ssrContext._ogImageInstances || []
  const script: Head['script'] = []
  if (src) {
    script.push({
      id: 'nuxt-og-image-options',
      type: 'application/json',
      processTemplateParams: true,
      innerHTML: () => {
        const payload = {
          title: '%s',
        }
        delete input.url
        // don't apply defaults
        // options is an object which has keys that may be kebab case, we need to convert the keys to camel case
        Object.entries({ ...input, url: undefined }).forEach(([key, val]) => {
          if (typeof val !== 'undefined') {
            // with a simple kebab case conversion
            // @ts-expect-error untyped
            payload[key.replace(/-([a-z])/g, g => g[1].toUpperCase())] = val
          }
        })
        return payload
      },
      // we want this to be last in our head
      tagPosition: 'bodyClose',
    })
  }
  const instance = useServerHead({
    script,
    meta,
  }, {
    tagPriority: 35,
  })
  ssrContext._ogImageInstances.push(instance)
}
