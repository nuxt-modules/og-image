import { onDevtoolsClientConnected } from '@nuxt/devtools-kit/iframe-client'
import type { $Fetch } from 'nitropack'
import { ref, watchEffect } from 'vue'
import type { NuxtDevtoolsClient, NuxtDevtoolsIframeClient } from '@nuxt/devtools-kit/types'

export const appFetch = ref<$Fetch>()

export const devtools = ref<NuxtDevtoolsClient>()

export const devtoolsClient = ref<NuxtDevtoolsIframeClient>()

export const colorMode = ref<'dark' | 'light'>()

onDevtoolsClientConnected(async (client) => {
  appFetch.value = client.host.app.$fetch
  watchEffect(() => {
    colorMode.value = client.host.app.colorMode.value
  })
  devtools.value = client.devtools
  devtoolsClient.value = client
})
