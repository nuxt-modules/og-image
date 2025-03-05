import type { Head } from '@unhead/vue'
import type { NuxtSSRContext } from 'nuxt/app'
import type { DefineOgImageInput, OgImageOptions, OgImagePrebuilt } from '../types'
import { componentNames } from '#build/nuxt-og-image/components.mjs'
import { useHead } from '#imports'
import { resolveUnrefHeadInput } from '@unhead/vue'
import { defu } from 'defu'
import { withQuery } from 'ufo'
import { unref } from 'vue'
import { generateMeta, separateProps } from '../shared'

export function createOgImageMeta(src: string | null, input: OgImageOptions | OgImagePrebuilt, resolvedOptions: OgImageOptions, ssrContext: NuxtSSRContext) {
  if (import.meta.client) {
    return
  }
  const _input = separateProps(defu(input, ssrContext._ogImagePayload))
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

  const instance = useHead({
    script,
    meta,
  }, {
    tagPriority: 'high',
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
