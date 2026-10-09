import { defineEventHandler } from 'h3'
import { useRuntimeConfig } from 'nitropack/runtime'

export default defineEventHandler((event) => {
  const runtimeConfig = useRuntimeConfig(event)
  const sharedRuntimeConfig = useRuntimeConfig()
  const cloudflareEnv = event.context.cloudflare?.env || event.context._platform?.cloudflare?.env

  return {
    eventRuntimeConfig: summarize(runtimeConfig),
    sharedRuntimeConfig: summarize(sharedRuntimeConfig),
    cloudflareEnv: {
      keys: Object.keys(cloudflareEnv || {}).sort(),
      NUXT_APP_SECRET: cloudflareEnv?.NUXT_APP_SECRET,
    },
  }
})

function summarize(runtimeConfig: Record<string, any>) {
  return {
    appSecret: runtimeConfig.appSecret,
    nuxtOgImageSecurity: runtimeConfig['nuxt-og-image']?.security,
    topLevelKeys: Object.keys(runtimeConfig).sort(),
  }
}
