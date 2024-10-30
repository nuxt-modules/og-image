import { defineNitroPlugin } from '#imports'
import { nuxtContentPlugin } from '../util/plugins'

export default defineNitroPlugin((nitroApp) => {
  nuxtContentPlugin(nitroApp)
})
