import type { NuxtDevtoolsClient, NuxtDevtoolsIframeClient } from '@nuxt/devtools-kit/types'
import type { BirpcReturn } from 'birpc'
import type { $Fetch } from 'nitropack/types'
import type { ClientFunctions, ServerFunctions } from '../../src/rpc-types'
import { onDevtoolsClientConnected } from '@nuxt/devtools-kit/iframe-client'
import { computed, ref, watchEffect } from 'vue'
import { base, globalRefreshTime, path, query, refreshSources } from '../util/logic'

export const appFetch = ref<$Fetch>()

export const devtools = ref<NuxtDevtoolsClient>()

export const devtoolsClient = ref<NuxtDevtoolsIframeClient>()

export const colorMode = ref<'dark' | 'light'>('dark')

export const ogImageRpc = ref<BirpcReturn<ServerFunctions>>()

// Connection state tracking
export const connectionState = ref<'connecting' | 'connected' | 'fallback' | 'failed'>('connecting')
export const isConnected = computed(() => connectionState.value === 'connected' || connectionState.value === 'fallback')
export const isConnectionFailed = computed(() => connectionState.value === 'failed')
export const isFallbackMode = computed(() => connectionState.value === 'fallback')

// Fallback fetch for localhost:3000
async function tryFallbackConnection() {
  const fallbackUrl = 'http://localhost:3000'
  const res = await fetch(`${fallbackUrl}/_og/debug.json`).catch(() => null)
  if (res?.ok) {
    // Set up fallback fetch
    appFetch.value = (url: string, opts?: any) => fetch(`${fallbackUrl}${url}`, opts).then(r => r.json())
    base.value = '/'
    path.value = '/'
    connectionState.value = 'fallback'
    return true
  }
  return false
}

// Set timeout for connection - if not connected within 2s, try fallback
const connectionTimeout = setTimeout(async () => {
  if (connectionState.value === 'connecting') {
    const fallbackWorked = await tryFallbackConnection()
    if (!fallbackWorked) {
      connectionState.value = 'failed'
    }
  }
}, 2000)

onDevtoolsClientConnected(async (client) => {
  clearTimeout(connectionTimeout)
  connectionState.value = 'connected'
  // @ts-expect-error untyped
  appFetch.value = client.host.app.$fetch
  // Sync base URL from host app for proper OG image URL construction
  // @ts-expect-error untyped
  base.value = client.host.nuxt.vueApp.config.globalProperties?.$router?.options?.history?.base || client.host.app.baseURL || '/'
  watchEffect(() => {
    colorMode.value = client.host.app.colorMode.value
  })
  const $route = client.host.nuxt.vueApp.config.globalProperties?.$route
  query.value = $route.query
  path.value = $route.path || '/'
  client.host.nuxt.$router.afterEach((route: any) => {
    query.value = route.query
    path.value = route.path
    refreshSources()
  })
  devtools.value = client.devtools
  devtoolsClient.value = client
  // @ts-expect-error untyped
  ogImageRpc.value = client.devtools.extendClientRpc<ServerFunctions, ClientFunctions>('nuxt-og-image', {
    refreshRouteData(path) {
      // if path matches
      // @ts-expect-error untyped
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
