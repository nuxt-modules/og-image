import type { BirpcReturn } from 'birpc'
import type { DevtoolsHost } from 'nuxtseo-layer-devtools/composables/host'
import type { ClientFunctions, ServerFunctions } from './rpc-types'
import { appFetch, useDevtoolsConnection } from 'nuxtseo-layer-devtools/composables/rpc'
import { base, path, refreshSources } from 'nuxtseo-layer-devtools/composables/state'
import { computed, ref } from 'vue'

export const host = ref<DevtoolsHost>()

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
  onConnected(connectedHost) {
    if (timer) {
      clearTimeout(timer)
    }
    connectionState.value = 'connected'
    host.value = connectedHost
    ogImageRpc.value = connectedHost.rpc<ServerFunctions, ClientFunctions>('nuxt-og-image', {
      refreshRouteData(path: string) {
        const file = connectedHost.route?.value?.matched?.[0]?.components?.default?.__file as string | undefined
        if (file?.includes(path) || path.endsWith('.md'))
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
})
