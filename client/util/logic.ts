import { computed, ref } from 'vue'
import { useDebounceFn } from '@vueuse/core'
import { withBase } from 'ufo'
import type {OgImageOptions, PlaygroundClientFunctions} from '../../src/types'
import { connectWS, createBirpcClient } from '#imports'

export const refreshTime = ref(Date.now())

export const description = ref<string | null>(null)
export const hostname = window.location.host
export const path = ref('/')
export const base = ref('/')

export const options = ref<OgImageOptions>({})

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
export const host = computed(() => withBase(base.value, `${window.location.protocol}//${hostname}`))
export const absoluteBasePath = computed(() => {
  return `${host.value}${path.value === '/' ? '' : path.value}`
})
