import { defineNitroPlugin } from '#imports'

export default defineNitroPlugin((nitroApp) => {
  nitroApp.hooks.hook('nuxt-og-image:context', async (ctx) => {
    // eslint-disable-next-line no-console
    console.log('Nitro hook ctx', !!ctx)
  })
  nitroApp.hooks.hook('nuxt-og-image:satori:vnodes', async (vnodes) => {
    // eslint-disable-next-line no-console
    console.log('Nitro hook vnodes', !!vnodes)
  })
})
