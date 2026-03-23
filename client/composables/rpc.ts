import type { NuxtDevtoolsIframeClient } from '@nuxt/devtools-kit/types'
import type { BirpcReturn } from 'birpc'
import type { ClientFunctions, ServerFunctions } from '../../src/rpc-types'
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { globalRefreshTime } from '../util/logic'

export const devtoolsClient = ref<NuxtDevtoolsIframeClient>()

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
    appFetch.value = ((url: string, opts?: any) => fetch(`${fallbackUrl}${url}`, opts).then(r => r.json())) as any
    base.value = '/'
    path.value = '/'
    connectionState.value = 'fallback'
    return true
  }
  return false
}

// Set timeout for connection - if not connected within 2s, try fallback
onMounted(() => {
  const timer = setTimeout(async () => {
    if (connectionState.value === 'connecting') {
      const fallbackWorked = await tryFallbackConnection()
      if (!fallbackWorked) {
        connectionState.value = 'failed'
      }
    }
  }, 2000)

  onUnmounted(() => {
    clearTimeout(timer)
  })
})

useDevtoolsConnection({
  onConnected(client) {
    connectionState.value = 'connected'
    base.value = client.host.nuxt.vueApp.config.globalProperties?.$router?.options?.history?.base || client.host.app.baseURL || '/'
    devtoolsClient.value = client
    // @ts-expect-error untyped
    ogImageRpc.value = client.devtools.extendClientRpc<ServerFunctions, ClientFunctions>('nuxt-og-image', {
      refreshRouteData(path: string) {
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
  },
  onRouteChange(route) {
    query.value = route.query
    path.value = route.path || '/'
    refreshSources()
  },
})
