import type { Head } from '@unhead/schema'
import type { NuxtSSRContext } from 'nuxt/app'
import type { DefineOgImageInput, OgImageOptions, OgImagePrebuilt } from '../types'
import { componentNames } from '#build/nuxt-og-image/components.mjs'
import { resolveUnrefHeadInput, useServerHead } from '@unhead/vue'
import { defu } from 'defu'
import { stringify } from 'devalue'
import { withQuery } from 'ufo'
import { unref } from 'vue'
import { generateMeta, separateProps } from '../shared'

export function createOgImageMeta(src: string | null, input: OgImageOptions | OgImagePrebuilt, resolvedOptions: OgImageOptions, ssrContext: NuxtSSRContext) {
  const _input = separateProps(defu(input, ssrContext._ogImagePayload))
  let url = src || input.url || resolvedOptions.url
  if (!url)
    return
  if (input._query && Object.keys(input._query).length && url)
    url = withQuery(url, { _query: input._query })
  const meta = generateMeta(url, resolvedOptions)
  ssrContext._ogImageInstances = ssrContext._ogImageInstances || []
  const script: Head['script'] = []
  if (src) {
    script.push({
      id: 'nuxt-og-image-options',
      type: 'application/json',
      processTemplateParams: true,
      innerHTML: () => {
        const payload = resolveUnrefHeadInput(_input)
        if (typeof payload.props.title === 'undefined')
          payload.props.title = '%s'
        delete payload.url
        if (payload._query && Object.keys(payload._query).length === 0) {
          delete payload._query
        }
        // don't apply defaults
        return stringify(payload)
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
  else if (!options.component) {
    // just pick first component
    options.component = componentNames[0]?.pascalName
  }
  return options
}
