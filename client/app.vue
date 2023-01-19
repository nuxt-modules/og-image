<script lang="ts" setup>
import { ref } from 'vue'
import { Tab, TabGroup, TabList, TabPanel, TabPanels } from '@headlessui/vue'
import { joinURL } from 'ufo'
import type { OgImagePayload, PlaygroundClientFunctions } from '../src/types'

const refreshTime = ref(Date.now())

const hostname = window.location.host as string
const host = `${window.location.protocol}//${hostname}`
const path = ref(useRoute().query.path || '/about')
const payloadPath = joinURL(path.value as string, '__og_image__/payload')

function refreshSources() {
  refreshTime.value = Date.now()
}

const clientFunctions: PlaygroundClientFunctions = {
  refresh(type) {
    // @todo this is pretty hacky, we should validate the file being changed is one we care about, not a big deal though
    // handle page changes
    if (type.startsWith('pages'))
      refreshSources()

    // handle component changes
    if (type.includes('/islands/') || type.endsWith('.island.vue'))
      refreshSources()
  },
}

await connectWS(hostname)
const rpc = createBirpcClient(clientFunctions)
const config = await rpc.useServerConfig()

useHead({
  title: 'OG Image Playground',
})

const width = config.value?.width || 1200
const height = config.value?.height || 630

const { data: payload } = await useAsyncData<OgImagePayload>(() => {
  return $fetch(payloadPath, {
    baseURL: host,
    watch: [path, refreshTime],
  })
})

const absoluteBasePath = `${host}${path.value === '/' ? '' : path.value}`
const OgImageTemplate = computed(() => resolveComponent(payload.value?.component || 'OgImageTemplate'))
const hasSatori = computed(() => payload.value?.provider === 'satori')
</script>

<template>
  <div class="2xl:flex-row flex-col flex h-screen">
    <header class="dark:(bg-dark-900 text-light) 2xl:(px-10 py-7) px-5 py-5 bg-light-200 text-dark-800 flex flex-col justify-between 2xl:h-full">
      <div>
        <div class="w-full flex items-start  justify-between space-x-5 2xl:mb-8 mb-3">
          <h1 class="text-sm">
            <div>OG Image Playground</div>
            <a href="https://github.com/harlan-zw/nuxt-og-image" class="underline text-xs opacity-50">nuxt-og-image</a>
          </h1>
          <NDarkToggle>
            <template #default="{ toggle }">
              <NButton n="borderless lg m-0" p-0 op50 @click="toggle">
                <NIcon icon="dark:carbon-moon carbon-sun" />
              </NButton>
            </template>
          </NDarkToggle>
        </div>
        <div class="2xl:(block space-y-4 space-x-0) space-x-6 flex justify-center">
          <div class="text-sm">
            <div class="text-xs opacity-60  mb-1">
              Path
            </div>
            <div class="flex items-center space-x-1">
              <span>{{ path }}</span>
            </div>
          </div>
          <div class="text-sm">
            <div class="text-xs opacity-60  mb-1">
              Provider
            </div>
            <div class="flex items-center space-x-1">
              <span :class="hasSatori ? 'logos-vercel-icon' : 'logos-chrome'" />
              <span>{{ hasSatori ? 'Satori' : 'Browser' }}</span>
            </div>
          </div>
          <div v-if="payload?.component" class="text-sm">
            <div class="text-xs opacity-60  mb-1">
              Component
            </div>
            <div class="flex items-center space-x-1">
              <span class="logos-vue" />
              <span>{{ payload?.component }}</span>
            </div>
          </div>
        </div>
      </div>
      <nav class="text-sm hidden 2xl:block" role="navigation">
        <ul class="mb-5">
          <li class="mb-2">
            <a href="https://github.com/harlan-zw/nuxt-og-image" target="_blank">Docs</a>
          </li>
          <li>
            <a href="https://github.com/sponsors/harlan-zw">Sponsor</a>
          </li>
        </ul>
        <a class="hidden 2xl:flex items-center" href="https://harlanzw.com" title="View Harlan's site." target="_blank">
          <div class="flex items-center">
            <img src="https://avatars.githubusercontent.com/u/5326365?v=4" class="rounded-full h-7 w-7 mr-2">
            <div class="flex flex-col">
              <span class="opacity-60 text-xs">Created by</span>
              <h1 class="text-sm opacity-80">harlanzw</h1>
            </div>
          </div>
        </a>
      </nav>
    </header>
    <main class="mx-auto flex-1 w-full py-7 ">
      <div class="max-h-full flex px-2 sm:px-0 2xl:(w-1205px mx-auto) mx-3">
        <div v-if="hasSatori" class="flex flex-col w-full">
          <TabGroup>
            <TabList class="p-1 dark:(bg-dark-900/20 border-none) border-2 border-dark-900/30 rounded-xl flex space-x-5">
              <Tab
                v-for="category in ['HTML', 'SVG - Satori', 'PNG - Satori + Resvg']"
                :key="category"
                v-slot="{ selected }"
                as="template"
              >
                <button
                  class="w-full rounded-lg py-2.5 text-sm font-medium leading-5 text-dark-700 ring-white ring-opacity-60 ring-offset-2 ring-offset-blue-400 focus:outline-none focus:ring-2"
                  :class="[
                    selected
                      ? 'text-dark-200 bg-light-900 dark:(bg-dark-300 text-light-100) shadow'
                      : 'dark:(bg-dark-800 text-light-900) text-blue-900/70 hover:(bg-blue-200)',
                  ]"
                >
                  {{ category }}
                </button>
              </Tab>
            </TabList>

            <TabPanels class="mt-2 flex tab-panels">
              <TabPanel>
                <IFrameLoader
                  :src="`${absoluteBasePath}/__og_image__/html?timestamp=${refreshTime}`"
                  :width="width"
                  :height="height"
                  description="[HTML] Generated in %sms."
                  @refresh="refreshSources"
                />
              </TabPanel>
              <TabPanel>
                <ImageLoader
                  :src="`${absoluteBasePath}/__og_image__/svg?timestamp=${refreshTime}`"
                  :width="width"
                  :height="height"
                  description="[SVG] Generated in %sms using Satori."
                  @refresh="refreshSources"
                />
              </TabPanel>
              <TabPanel>
                <ImageLoader
                  :src="`${absoluteBasePath}/__og_image__/og.png?timestamp=${refreshTime}`"
                  :width="width"
                  :height="height"
                  description="[PNG] Generated in %sms using Satori & Resvg."
                  @refresh="refreshSources"
                />
              </TabPanel>
            </TabPanels>
          </TabGroup>
        </div>
        <ImageLoader
          v-else
          :src="`${absoluteBasePath}/__og_image__/og.png?timestamp=${refreshTime}`"
          :width="width"
          :height="height"
          description="[PNG] Generated in %sms using browser screenshot."
          @refresh="refreshSources"
        />
      </div>
    </main>
    <footer class="block 2xl:hidden space-x-5 flex justify-center items-center pb-7">
      <ul class="flex space-x-5">
        <li class="mb-2">
          <a href="https://github.com/harlan-zw/nuxt-og-image" target="_blank">Docs</a>
        </li>
        <li>
          <a href="https://github.com/sponsors/harlan-zw">Sponsor</a>
        </li>
      </ul>
      <a class="flex items-center" href="https://harlanzw.com" title="View Harlan's site." target="_blank">
        <div class="flex items-center">
          <img src="https://avatars.githubusercontent.com/u/5326365?v=4" class="rounded-full h-7 w-7 mr-2">
          <div class="flex flex-col">
            <span class="opacity-60 text-xs">Created by</span>
            <h1 class="text-sm opacity-80">harlanzw</h1>
          </div>
        </div>
      </a>
    </footer>
  </div>
</template>

<style>
.tab-panels {
  width: 100%;
}
div[role="tabpanel"] {
  width: 100%;
  display: flex;
}
</style>
