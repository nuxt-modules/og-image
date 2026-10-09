import { defineNitroPlugin } from 'nitropack/runtime'

export default defineNitroPlugin((nitro) => {
  nitro.hooks.hook('nuxt-og-image:context', () => {
    if (process.env.OG_IMAGE_TEST_BLOCK_RENDER)
      throw new Error('The repeat build must reuse published images without rendering.')
  })
})
