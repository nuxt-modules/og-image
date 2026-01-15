import type { H3Event } from 'h3'
import { useStorage } from 'nitropack/runtime'

export async function resolve(event: H3Event, path: string) {
  const fontFileName = path.split(':').pop()
  const fontsStorage = useStorage('nuxt-og-image:fonts')
  return await fontsStorage.getItem(fontFileName!) as string | Uint8Array
}
