import { computed, ref } from 'vue'
import { useDebounceFn } from '@vueuse/core'
import { withBase } from 'ufo'
import type { OgImageOptions } from '../../src/runtime/types'

export const refreshTime = ref(Date.now())

export const description = ref<string | null>(null)
export const hostname = window.location.host
export const path = ref('/')
export const base = ref('/')

export const options = ref<OgImageOptions>({})

// prop editing
export const optionsOverrides = ref({})
export const propsEdited = ref(false)
export const optionsEditor = ref({})

export const refreshSources = useDebounceFn(() => {
  refreshTime.value = Date.now()
}, 200)

export const slowRefreshSources = useDebounceFn(() => {
  refreshTime.value = Date.now()
}, 1000)

// const clientFunctions: PlaygroundClientFunctions = {
//   refresh() {
//     propsEdited.value = false
//     optionsOverrides.value = {}
//     // @todo this is pretty hacky, we should validate the file being changed is one we care about
//     refreshSources()
//   },
// }

export const containerWidth = ref<number | null>(null)
export const host = computed(() => withBase(base.value, `${window.location.protocol}//${hostname}`))
export const absoluteBasePath = computed(() => {
  return `${host.value}${path.value === '/' ? '' : path.value}`
})
