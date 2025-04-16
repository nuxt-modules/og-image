import type { Head } from '@unhead/vue'
import type { NuxtSSRContext } from 'nuxt/app'
import type { OgImageOptions, OgImagePrebuilt } from '../types'
import { componentNames } from '#build/nuxt-og-image/components.mjs'
import { useHead } from '#imports'
import { resolveUnrefHeadInput } from '@unhead/vue'
import { defu } from 'defu'
import { stringify } from 'devalue'
import { withQuery } from 'ufo'
import { generateMeta, separateProps, useOgImageRuntimeConfig } from '../shared'

export function setHeadOgImagePrebuilt(input: OgImagePrebuilt) {
  if (import.meta.client) {
    return
  }
  const url = input.url
  if (!url)
    return
  const meta = generateMeta(url, input)
  useHead({ meta }, { tagPriority: 'high' })
}

export function createOgImageMeta(src: string, input: OgImageOptions | OgImagePrebuilt, ssrContext: NuxtSSRContext) {
  if (import.meta.client) {
    return
  }
  const { defaults } = useOgImageRuntimeConfig()
  const _input = separateProps(defu(input, ssrContext._ogImagePayload))
  if (input._query && Object.keys(input._query).length)
    src = withQuery(src, { _query: input._query })
  const meta = generateMeta(src, input)
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
        payload.component = resolveComponentName(input.component, defaults.component)
        delete payload.url
        if (payload._query && Object.keys(payload._query).length === 0) {
          delete payload._query
        }
        const final = {}
        for (const k in payload) {
          if (payload[k] !== defaults[k]) {
            final[k] = payload[k]
          }
        }
        // don't apply defaults
        return stringify(final)
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
  })
  ssrContext._ogImagePayload = _input
  ssrContext._ogImageInstances.push(instance)
}

export function resolveComponentName(component: OgImageOptions['component'], fallback: string): OgImageOptions['component'] {
  component = component || fallback || componentNames?.[0]?.pascalName
  // try and fix component name if we're using a shorthand (i.e Banner instead of OgImageBanner)
  if (component && componentNames) {
    const originalName = component
    for (const component of componentNames) {
      if (component.pascalName.endsWith(originalName) || component.kebabName.endsWith(originalName)) {
        return component.pascalName
      }
    }
  }
  return component
}
