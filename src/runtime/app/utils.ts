import type { Head } from '@unhead/schema'
import type { NuxtSSRContext } from 'nuxt/app'
import type { DefineOgImageInput, OgImageOptions, OgImagePrebuilt } from '../types'
import { componentNames } from '#build/nuxt-og-image/components.mjs'
import { useServerHead } from '@unhead/vue'
import { defu } from 'defu'
import { withQuery } from 'ufo'
import { unref } from 'vue'
import { generateMeta, separateProps } from '../shared'

export function createOgImageMeta(src: string | null, input: OgImageOptions | OgImagePrebuilt, resolvedOptions: OgImageOptions, ssrContext: NuxtSSRContext) {
  const payloads = ssrContext._ogImagePayloads as [string, OgImageOptions, Required<Head>['meta']] || []
  resolvedOptions.key = resolvedOptions.key || 'default'
  const currentPayload = payloads.find(([k]) => k === resolvedOptions.key)
  const _input = separateProps(defu(input, currentPayload?.[1]))
  let url = src || input.url || resolvedOptions.url
  if (!url)
    return
  if (input._query && Object.keys(input._query).length && url)
    url = withQuery(url, { _query: input._query })
  const meta = generateMeta(url, resolvedOptions)
  if (!currentPayload) {
    payloads.push([resolvedOptions.key, _input, meta])
  }
  else {
    const idx = payloads.findIndex(([k]) => k === resolvedOptions.key)
    payloads[idx] = [resolvedOptions.key, _input, meta]
  }

  ssrContext._ogImageInstance?.dispose()
  ssrContext._ogImageInstance = useServerHead({
    // script,
    meta() {
      const finalPayload = ssrContext._ogImagePayloads as [string, OgImageOptions, Head['meta']] || []
      return finalPayload.flatMap(([_, __, meta]) => meta)
    },
  }, {
    processTemplateParams: true,
    tagPriority: 35,
  })
  ssrContext._ogImagePayloads = payloads
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
