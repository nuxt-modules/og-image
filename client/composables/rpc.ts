import type { NuxtDevtoolsClient, NuxtDevtoolsIframeClient } from '@nuxt/devtools-kit/types'
import type { BirpcReturn } from 'birpc'
import type { $Fetch } from 'nitropack'
import type { ClientFunctions, ServerFunctions } from '../../src/rpc-types'
import { onDevtoolsClientConnected } from '@nuxt/devtools-kit/iframe-client'
import { ref, watchEffect } from 'vue'
import { globalRefreshTime, path, query, refreshSources } from '~/util/logic'

export const appFetch = ref<$Fetch>()

export const devtools = ref<NuxtDevtoolsClient>()

export const devtoolsClient = ref<NuxtDevtoolsIframeClient>()

export const colorMode = ref<'dark' | 'light'>('dark')

export const ogImageRpc = ref<BirpcReturn<ServerFunctions>>()

onDevtoolsClientConnected(async (client) => {
  appFetch.value = client.host.app.$fetch
  watchEffect(() => {
    colorMode.value = client.host.app.colorMode.value
  })
  const $route = client.host.nuxt.vueApp.config.globalProperties?.$route
  query.value = $route.query
  path.value = $route.path || '/'
  client.host.nuxt.$router.afterEach((route) => {
    query.value = route.query
    path.value = route.path
    refreshSources()
  })
  devtools.value = client.devtools
  devtoolsClient.value = client
  ogImageRpc.value = client.devtools.extendClientRpc<ServerFunctions, ClientFunctions>('nuxt-og-image', {
    refreshRouteData(path) {
      // if path matches
      if (devtoolsClient.value?.host.nuxt.vueApp.config?.globalProperties?.$route.matched[0].components?.default.__file.includes(path) || path.endsWith('.md'))
        refreshSources()
    },
    refresh() {
      refreshSources()
    },
    refreshGlobalData() {
      globalRefreshTime.value = Date.now()
    },
  })
})
