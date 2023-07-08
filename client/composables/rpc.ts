import { createBirpc } from 'birpc'
import { parse, stringify } from 'flatted'
import { ref } from 'vue'
import type { PlaygroundClientFunctions, PlaygroundServerFunctions } from '../../src/runtime/types'
import { useAsyncData } from '#imports'

// copied from nuxt/devtools, credits @antfu

const RECONNECT_INTERVAL = 2000
// eslint-disable-next-line @typescript-eslint/ban-types
let onMessage: Function = () => {}

export const wsConnecting = ref(true)
export const wsError = ref<any>()

export const wsClient = ref<WebSocket | null>(null)

export function createBirpcClient(clientFunctions: PlaygroundClientFunctions) {
  const rpc = createBirpc<PlaygroundServerFunctions>(clientFunctions, {
    post: d => wsClient.value!.send(d),
    on: (fn) => {
      onMessage = fn
    },
    serialize: stringify,
    deserialize: parse,
  })
  return {
    useServerConfig: async function useServerConfig() {
      const serverConfigRef = await useAsyncData('server-config', () => rpc.getConfig())
      return serverConfigRef.data
    },
  }
}

export async function connectWS(hostname: string) {
  const ws = new WebSocket(`ws://${hostname}/__nuxt_og_image__/entry`)
  ws.addEventListener('message', e => onMessage(String(e.data)))
  ws.addEventListener('error', (e) => {
    wsError.value = e
  })
  ws.addEventListener('close', () => {
    // eslint-disable-next-line no-console
    console.log('[nuxt-og-image] WebSocket closed, reconnecting...')
    setTimeout(async () => {
      wsClient.value = await connectWS(hostname)
    }, RECONNECT_INTERVAL)
  })
  wsConnecting.value = true
  if (ws.readyState !== WebSocket.OPEN)
    await new Promise(resolve => ws.addEventListener('open', resolve))
  // eslint-disable-next-line no-console
  console.log('[nuxt-og-image] WebSocket connected.')
  wsConnecting.value = false
  wsError.value = null
  return ws
}
