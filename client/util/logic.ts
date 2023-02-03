import { ref } from 'vue'
import { useDebounceFn } from '@vueuse/core'
import type { PlaygroundClientFunctions } from '../../src/types'

export const refreshTime = ref(Date.now())

export const description = ref<string | null>(null)
export const hostname = window.location.host
export const host = `${window.location.protocol}//${hostname}`
export const path = ref('/')

export const refreshSources = useDebounceFn(() => {
  refreshTime.value = Date.now()
}, 200)

const clientFunctions: PlaygroundClientFunctions = {
  refresh() {
    // @todo this is pretty hacky, we should validate the file being changed is one we care about
    refreshSources()
  },
}

await connectWS(hostname)
export const rpc = createBirpcClient(clientFunctions)

export const containerWidth = ref<number | null>(null)

export const absoluteBasePath = computed(() => {
  return `${host}${path.value === '/' ? '' : path.value}`
})
