import type { OgImageOptionsInternal } from '../../src/runtime/types'
import { hasProductionUrl, host, previewSource, productionUrl } from 'nuxtseo-layer-devtools/composables/state'
import { computed, ref } from 'vue'

export const description = ref<string | null>(null)
export const ogImageKey = ref()

export const options = ref<OgImageOptionsInternal>({})

// prop editing
export const optionsOverrides = ref<OgImageOptionsInternal>({})
export const hasMadeChanges = ref(false)
export const propEditor = ref({})

const RE_TRAILING_SLASH = /\/$/

export const previewHost = computed(() => {
  if (previewSource.value === 'production' && hasProductionUrl.value)
    return productionUrl.value.replace(RE_TRAILING_SLASH, '')
  return host.value
})
