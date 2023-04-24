import { defineEventHandler, setHeader } from 'h3'
import { useRuntimeConfig } from '#imports'

export default defineEventHandler(async (e) => {
  // set json header
  setHeader(e, 'Content-Type', 'application/json')
  const runtimeConfig = useRuntimeConfig()['nuxt-og-image']
  return {
    runtimeConfig,
  }
})
