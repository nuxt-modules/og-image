import { defineNitroPlugin } from 'nitropack/runtime'
import { nuxtContentPlugin } from '../util/plugins'

export default defineNitroPlugin((nitroApp) => {
  nuxtContentPlugin(nitroApp)
})
