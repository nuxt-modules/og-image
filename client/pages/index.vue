<script lang="ts" setup>
import { Tab, TabGroup, TabList, TabPanel, TabPanels } from '@headlessui/vue'
import { absoluteBasePath, containerWidth, refreshSources, refreshTime, rpc } from '~/util/logic'

const config = await rpc.useServerConfig()

const height = config.value?.height || 630
const width = config.value?.width || 1200

const options = await fetchOptions()
</script>

<template>
  <div class="lg:p-5">
    <div class="max-h-full flex p-2 sm:px-0 2xl:(w-1205px mx-auto) mx-3 transition-all" :style="containerWidth ? { width: `${containerWidth}px` } : {}">
      <div v-if="options.provider === 'satori'" class="flex flex-col w-full">
        <TabGroup>
          <TabList class="p-1 dark:(bg-dark-900/20 border-none) border-1 border-light-500 rounded-xl flex space-x-5">
            <Tab
              v-for="category in ['HTML - Vue', 'SVG - Satori', 'PNG - Satori + Resvg']"
              :key="category"
              v-slot="{ selected }"
              as="template"
            >
              <button
                class="w-full rounded-lg py-2.5 text-sm font-medium leading-5 text-dark-700 ring-white ring-opacity-60 ring-offset-2 ring-offset-blue-400 focus:outline-none focus:ring-2"
                :class="[
                  selected
                    ? 'text-dark-200 bg-white dark:(bg-dark-300 text-light-100) shadow'
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
                :src="`${absoluteBasePath}/__og_image__/html?timestamp=${refreshTime}&scale=${!containerWidth ? 1 : (containerWidth - 12) / 1200}`"
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
  </div>
</template>
