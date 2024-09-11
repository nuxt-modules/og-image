import { defineNitroPlugin } from 'nitropack/dist/runtime/plugin'
import { nuxtContentPlugin } from '../util/plugins'

export default defineNitroPlugin((nitroApp) => {
  nuxtContentPlugin(nitroApp)
})
