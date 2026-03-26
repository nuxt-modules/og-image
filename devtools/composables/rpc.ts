import type { NuxtDevtoolsIframeClient } from '@nuxt/devtools-kit/types'
import type { BirpcReturn } from 'birpc'
import type { ClientFunctions, ServerFunctions } from '../../src/rpc-types'
import { appFetch, useDevtoolsConnection } from 'nuxtseo-layer-devtools/composables/rpc'
import { base, path, query, refreshSources } from 'nuxtseo-layer-devtools/composables/state'
import { computed, ref } from 'vue'

export const devtoolsClient = ref<NuxtDevtoolsIframeClient>()

export const ogImageRpc = ref<BirpcReturn<ServerFunctions>>()

// Connection state tracking
const connectionState = ref<'connecting' | 'connected' | 'fallback' | 'failed'>('connecting')
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

let timer: null | NodeJS.Timeout = null

// Set timeout for connection - if not connected within 2s, try fallback
onMounted(() => {
  timer = setTimeout(async () => {
    if (connectionState.value === 'connecting') {
      const fallbackWorked = await tryFallbackConnection()
      if (!fallbackWorked) {
        connectionState.value = 'failed'
      }
    }
    timer = null
  }, 2000)

  onUnmounted(() => {
    if (timer) {
      clearTimeout(timer)
    }
  })
})

useDevtoolsConnection({
  onConnected(client) {
    if (timer) {
      clearTimeout(timer)
    }
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
        refreshSources()
      },
    })
  },
  onRouteChange(route) {
    query.value = route.query
    path.value = route.path || '/'
    refreshSources()
  },
})
