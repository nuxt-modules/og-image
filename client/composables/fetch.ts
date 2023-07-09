import { useAsyncData } from '#imports'
import type { OgImageOptions } from '../../src/runtime/types'
import { host, path, refreshTime } from '~/util/logic'

export async function fetchOptions() {
  const { data } = await useAsyncData<OgImageOptions>(() => {
    return $fetch('/api/og-image-options', {
      baseURL: host.value,
      query: { path: path.value },
    })
  }, {
    watch: [path, refreshTime],
  })
  return data
}

export async function fetchVNodes() {
  const { data: options } = await useAsyncData<OgImageOptions>(() => {
    return $fetch('/api/og-image-vnode', {
      query: { path: path.value },
      baseURL: host.value,
    })
  }, {
    watch: [path, refreshTime],
  })
  return options
}
