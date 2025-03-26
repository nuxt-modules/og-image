import type { V as VueHeadClient } from '@unhead/vue/dist/shared/vue.71760da0'
import type { OgImageComponent, OgImageOptions, OgImageRuntimeConfig } from '../../src/runtime/types'
import { appFetch, devtoolsClient, useAsyncData } from '#imports'
import { joinURL } from 'ufo'
import { globalRefreshTime, optionsOverrides, path, refreshTime } from '~/util/logic'

export function fetchPathDebug() {
  return useAsyncData<{ siteConfig: { url?: string }, options: OgImageOptions, vnodes: Record<string, any> }>(async () => {
    if (!appFetch.value)
      return { siteCofig: {}, options: {}, vnodes: {} }

    const clientHead = devtoolsClient.value?.host.nuxt.vueApp.config?.globalProperties?.$head as VueHeadClient
    const tags = await clientHead?.resolveTags() || []
    const ogImageSrc = tags.find(d => d._d === 'meta:property:og:image')?.props.content
    if (ogImageSrc && !ogImageSrc.startsWith('/__og-image__/image')) {
      // generate the social
      return {
        siteConfig: {},
        options: {
          url: ogImageSrc,
          socialPreview: {
            og: {
              title: tags.find(d => d._d === 'meta:property:og:title')?.props.content,
              description: tags.find(d => d._d === 'meta:property:og:description')?.props.content,
            },
            twitter: {
              title: tags.find(d => d._d === 'meta:name:twitter:title')?.props.content,
              description: tags.find(d => d._d === 'meta:name:twitter:description')?.props.content,
            },
          },
        },
        vnodes: {},
        custom: true,
      }
    }
    return appFetch.value(joinURL('/__og-image__/image', path.value, 'og.json'), {
      query: optionsOverrides.value,
    })
  }, {
    watch: [path, refreshTime],
  })
}

export function fetchGlobalDebug() {
  return useAsyncData<{ runtimeConfig: OgImageRuntimeConfig, componentNames: OgImageComponent[] }>('global-debug', () => {
    if (!appFetch.value)
      return { runtimeConfig: {} }
    return appFetch.value('/__og-image__/debug.json')
  }, {
    watch: [globalRefreshTime],
  })
}
