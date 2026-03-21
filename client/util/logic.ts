import type { OgImageOptionsInternal } from '../../src/runtime/types'
import { useDebounceFn, useLocalStorage } from '@vueuse/core'
import { hasProtocol, withBase } from 'ufo'
import { computed, ref } from 'vue'

export const refreshTime = ref(Date.now())
export const globalRefreshTime = ref(Date.now())

export const description = ref<string | null>(null)
export const hostname = window.location.host
export const ogImageKey = ref()
export const path = ref('/')
export const query = ref()
export const base = ref('/')

export const options = ref<OgImageOptionsInternal>({})

// prop editing
export const optionsOverrides = ref<OgImageOptionsInternal>({})
export const hasMadeChanges = ref(false)
export const propEditor = ref({})

export const refreshSources = useDebounceFn(() => {
  refreshTime.value = Date.now()
}, 200)

export const slowRefreshSources = useDebounceFn(() => {
  refreshTime.value = Date.now()
}, 1000)

export const host = computed(() => withBase(base.value, `${window.location.protocol}//${hostname}`))

// Production preview: lets users test OG images against their deployed site
export const previewSource = useLocalStorage<'local' | 'production'>('nuxt-og-image:preview-source', 'local')
export const productionUrl = ref<string>('')

export const hasProductionUrl = computed(() => {
  const url = productionUrl.value
  if (!url || !hasProtocol(url))
    return false
  // Don't show toggle if production URL is just localhost
  return !url.includes('localhost') && !url.includes('127.0.0.1')
})

const RE_TRAILING_SLASH = /\/$/

export const previewHost = computed(() => {
  if (previewSource.value === 'production' && hasProductionUrl.value)
    return productionUrl.value.replace(RE_TRAILING_SLASH, '')
  return host.value
})
