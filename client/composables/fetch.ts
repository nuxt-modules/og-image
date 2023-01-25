import type { OgImageOptions } from '../../src/types'
import { host, optionsPath, path, refreshTime, vnodePath } from '~/util/logic'
export async function fetchOptions() {
  const { data: options } = await useAsyncData<OgImageOptions>(() => {
    return $fetch(optionsPath.value, {
      baseURL: host,
    })
  }, {
    watch: [path, refreshTime],
  })
  return options
}

export async function fetchVNodes() {
  const { data: options } = await useAsyncData<OgImageOptions>(() => {
    return $fetch(vnodePath.value, {
      baseURL: host,
    })
  }, {
    watch: [path, refreshTime],
  })
  return options
}
