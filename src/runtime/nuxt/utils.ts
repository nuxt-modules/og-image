import type { Head } from '@unhead/schema'
import { defu } from 'defu'
import { withQuery } from 'ufo'
import { separateProps } from '../utils'
import type { DefineOgImageInput, OgImageOptions, OgImagePrebuilt } from '../types'
import { unref, useServerHead } from '#imports'

// @ts-expect-error untyped
import { componentNames } from '#build/nuxt-og-image/components.mjs'

export function createOgImageMeta(src: string | null, input: OgImageOptions | OgImagePrebuilt, resolvedOptions: OgImageOptions, ssrContext: Record<string, any>) {
  const _input = separateProps(defu(input, ssrContext._ogImagePayload))
  let url = src || input.url || resolvedOptions.url
  if (input._query && url)
    url = withQuery(url, { _query: input._query })
  let urlExtension = (url.split('/').pop() || url).split('.').pop() || resolvedOptions.extension
  if (urlExtension === 'jpg')
    urlExtension = 'jpeg'
  const meta: Head['meta'] = [
    { property: 'og:image', content: url },
    { property: 'og:image:type', content: `image/${urlExtension}` },
    { name: 'twitter:card', content: 'summary_large_image' },
    // we don't need this but avoids issue when using useSeoMeta({ twitterImage })
    { name: 'twitter:image', content: url },
    { name: 'twitter:image:src', content: url },
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
        if (!_input.props.title)
          _input.props.title = '%s'
        delete _input.url
        // don't apply defaults
        return _input
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
  ssrContext._ogImagePayload = _input
  ssrContext._ogImageInstances.push(instance)
}

export function normaliseOptions(_options: DefineOgImageInput): OgImageOptions | OgImagePrebuilt {
  const options = { ...unref(_options) } as OgImageOptions
  if (!options)
    return options
  // try and fix component name if we're using a shorthand (i.e Banner instead of OgImageBanner)
  if (options.component && componentNames) {
    const originalName = options.component
    for (const component of componentNames) {
      if (component.pascalName.endsWith(originalName) || component.kebabName.endsWith(originalName)) {
        options.component = component.pascalName
        break
      }
    }
  }
  return options
}
