import type { OgImageOptions } from '../../src/runtime/types'
import { useDebounceFn } from '@vueuse/core'
import { withBase } from 'ufo'
import { computed, ref } from 'vue'

export const refreshTime = ref(Date.now())
export const globalRefreshTime = ref(Date.now())

export const description = ref<string | null>(null)
export const hostname = window.location.host
export const ogImageKey = ref()
export const path = ref('/')
export const query = ref()
export const base = ref('/')

export const options = ref<OgImageOptions>({})

// prop editing
export const optionsOverrides = ref<OgImageOptions>({})
export const hasMadeChanges = ref(false)
export const propEditor = ref({})

export const refreshSources = useDebounceFn(() => {
  refreshTime.value = Date.now()
}, 200)

export const slowRefreshSources = useDebounceFn(() => {
  refreshTime.value = Date.now()
}, 1000)

export const host = computed(() => withBase(base.value, `${window.location.protocol}//${hostname}`))
