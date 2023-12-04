import { onDevtoolsClientConnected } from '@nuxt/devtools-kit/iframe-client'
import type { $Fetch } from 'nitropack'
import { ref, watchEffect } from 'vue'
import type { NuxtDevtoolsClient, NuxtDevtoolsIframeClient } from '@nuxt/devtools-kit/types'
import type { ClientFunctions, ServerFunctions } from '../../src/rpc-types'
import { globalRefreshTime, path, refreshSources } from '~/util/logic'

export const appFetch = ref<$Fetch>()

export const devtools = ref<NuxtDevtoolsClient>()

export const devtoolsClient = ref<NuxtDevtoolsIframeClient>()

export const colorMode = ref<'dark' | 'light'>('dark')

onDevtoolsClientConnected(async (client) => {
  appFetch.value = client.host.app.$fetch
  watchEffect(() => {
    colorMode.value = client.host.app.colorMode.value
  })
  path.value = client.host.nuxt.vueApp.config.globalProperties?.$route.path || '/'
  client.host.nuxt.$router.afterEach((route) => {
    path.value = route.path
    refreshSources()
  })
  devtools.value = client.devtools
  devtoolsClient.value = client
  client.devtools.extendClientRpc<ServerFunctions, ClientFunctions>('nuxt-og-image', {
    refreshRouteData(path) {
      // if path matches
      if (devtoolsClient.value?.host.nuxt.vueApp.config?.globalProperties?.$route.matched[0].components?.default.__file.includes(path))
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
