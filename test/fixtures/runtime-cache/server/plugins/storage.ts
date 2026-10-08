import memoryDriver from 'unstorage/drivers/memory'
import { defineNitroPlugin, useStorage } from '#nuxtseo/nitro'

export default defineNitroPlugin(() => {
  useStorage().mount('custom', memoryDriver())
})
