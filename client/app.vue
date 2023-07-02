<script lang="ts" setup>
import { useDebounceFn } from '@vueuse/core'
import { base, containerWidth, description, path, options, refreshSources } from './util/logic'
import { $computed, computed, fetchOptions, useHead, useRoute, watch, watchEffect } from '#imports'
import { devtoolsClient } from '~/composables/devtools-client'

useHead({
  title: 'OG Image Playground',
})

const isDevTools = computed(() => !!devtoolsClient.value)

const clientPath = $computed(() => devtoolsClient.value?.host.nuxt.vueApp.config?.globalProperties?.$route?.path || undefined)
path.value = clientPath || useRoute().query.path as string || '/'
base.value = useRoute().query.base as string || '/'
watch(() => clientPath, (v) => {
  path.value = v
})

const constrainsWidth = computed(() => {
  return useRoute().path !== '/vnodes' && useRoute().path !== '/options'
})

watchEffect(async () => {
  options.value = (await fetchOptions()).value
})

const setPath = useDebounceFn((e) => {
  path.value = e.target.value
  refreshSources()
}, 1000)
</script>

<template>
  <div class="flex-row flex h-screen">
    <header class="border-r-1 border-light-400 dark:(border-dark-400 bg-dark-900 text-light) bg-white text-dark-800 flex flex-col justify-between h-screen z-5">
      <div class="flex-grow hidden md:block">
        <div class="py-3 w-full flex items-start px-5 justify-between space-x-5">
          <h1 class="text-base w-40">
            OG Image Playground
          </h1>
          <NDarkToggle v-if="!isDevTools">
            <template #default="{ toggle }">
              <NButton n="borderless lg m-0" p-0 op50 @click="toggle">
                <NIcon icon="dark:carbon-moon carbon-sun" />
              </NButton>
            </template>
          </NDarkToggle>
        </div>
        <hr class="border-1 border-light-400 dark:border-dark-400">
        <div class="py-7 px-5 text-sm flex flex-col space-y-3">
          <NuxtLink v-slot="{ isActive }" to="/" class="transition-all hover:(ml-1) whitespace-nowrap">
            <Icon name="carbon:image-search" class="mr-1" :class="[isActive ? 'opacity-90' : 'opacity-60']" />
            <span :class="[isActive ? 'underline' : 'opacity-60']">
              {{ options.component }}.vue
            </span>
          </NuxtLink>
          <NuxtLink v-if="options.provider === 'satori'" v-slot="{ isActive }" to="/svg" class="transition-all hover:(ml-1) whitespace-nowrap">
            <Icon name="carbon:svg" class="mr-1" :class="[isActive ? 'opacity-90' : 'opacity-60']" />
            <span :class="[isActive ? 'underline' : 'opacity-60']">
              Preview SVG
            </span>
          </NuxtLink>
          <NuxtLink v-slot="{ isActive }" to="/png" class="transition-all hover:(ml-1) whitespace-nowrap">
            <Icon name="carbon:png" class="mr-1" :class="[isActive ? 'opacity-90' : 'opacity-60']" />
            <span :class="[isActive ? 'underline' : 'opacity-60']">
              Preview PNG
            </span>
          </NuxtLink>
          <NuxtLink v-slot="{ isActive }" to="/options" class="transition-all hover:(ml-1) whitespace-nowrap">
            <Icon name="carbon:operations-record" class="mr-1" :class="[isActive ? 'opacity-90' : 'opacity-60']" />
            <span :class="[isActive ? 'underline' : 'opacity-60']">
              Options
            </span>
          </NuxtLink>
          <NuxtLink v-slot="{ isActive }" to="/vnodes" class="transition-all hover:(ml-1) whitespace-nowrap">
            <Icon name="carbon:ibm-cloud-pak-manta-automated-data-lineage" class="mr-1" :class="[isActive ? 'opacity-90' : 'opacity-60']" />
            <span :class="[isActive ? 'underline' : 'opacity-60']">
              vNodes
            </span>
          </NuxtLink>
        </div>
        <hr class="border-1 border-light-400 dark:border-dark-400">
        <div v-if="constrainsWidth" class="py-7 px-5 text-sm flex flex-col space-y-3">
          <div v-if="containerWidth !== 504" @click="containerWidth = 504">
            <NButton>
              <Icon name="carbon:mobile" />
              Small
            </NButton>
          </div>
          <div v-if="containerWidth !== null" @click="containerWidth = null">
            <NButton>
              <Icon name="carbon:laptop" />
              Full width
            </NButton>
          </div>
          <div>
            <NButton @click="refreshSources">
              Refresh
            </NButton>
          </div>
        </div>
      </div>
    </header>
    <main class="mx-auto flex flex-col w-full bg-white dark:bg-black max-h-screen overflow-hidden dark:bg-dark-700 bg-light-200 ">
      <div class="py-9px dark:(bg-dark-800) bg-light-200 px-10 opacity-80 flex items-center max-w-full block space-x-5">
        <div class="text-sm flex items-center space-x-5">
          <div class="text-xs opacity-40">
            Path
          </div>
          <div class="flex items-center space-x-1">
            <NTextInput :model-value="path" placeholder="Search..." n="primary" @input="setPath" />
          </div>
        </div>
        <div v-if="description" class="text-xs opacity-70">
          {{ description }}
        </div>
      </div>
      <hr class="border-1 border-light-400 dark:border-dark-400">
      <div class="h-full max-h-full overflow-hidden lg:p-10 p-3" :style="{ width: containerWidth && constrainsWidth ? `${containerWidth}px` : '100%' }">
        <NuxtPage />
      </div>
    </main>
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
