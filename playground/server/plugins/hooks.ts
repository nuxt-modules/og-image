// @ts-expect-error untyped
import { defineNitroPlugin } from '#imports'

export default defineNitroPlugin((nitroApp: any) => {
  nitroApp.hooks.hook('nuxt-og-image:context', async (ctx: any) => {
    // eslint-disable-next-line no-console
    console.log('Nitro hook ctx', !!ctx)
  })
  nitroApp.hooks.hook('nuxt-og-image:satori:vnodes', async (vnodes: any) => {
    // eslint-disable-next-line no-console
    console.log('Nitro hook vnodes', !!vnodes)
  })
})
