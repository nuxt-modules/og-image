import type { NitroRuntimeConfig } from 'nitropack'
import type { RuntimeConfig } from 'nuxt/schema'

declare const nitroRuntimeConfig: NitroRuntimeConfig

const nuxtRuntimeConfig: RuntimeConfig = nitroRuntimeConfig

void nuxtRuntimeConfig
