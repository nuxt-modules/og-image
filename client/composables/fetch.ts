import type { OgImageOptions } from '../../src/types'
import { useAsyncData } from '#imports'
import { host, path, refreshTime } from '~/util/logic'

export async function fetchOptions() {
  const { data: options } = await useAsyncData<OgImageOptions>(() => {
    return $fetch('/api/og-image-options', {
      baseURL: host.value,
      query: { path: path.value },
    })
  }, {
    watch: [path, refreshTime],
  })
  return options
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
