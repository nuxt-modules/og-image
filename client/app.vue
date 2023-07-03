<script lang="ts" setup>
import { useDebounceFn } from '@vueuse/core'
import JsonEditorVue from 'json-editor-vue'
import 'vanilla-jsoneditor/themes/jse-theme-dark.css'
import { Pane, Splitpanes } from 'splitpanes'
import { version } from '../package.json'
import {
  base,
  containerWidth,
  description,
  options,
  optionsEditor,
  optionsOverrides,
  path,
  propsEdited,
  refreshSources,
  slowRefreshSources,
} from './util/logic'
import { $computed, computed, fetchOptions, unref, useColorMode, useHead, useRoute, watch } from '#imports'
import { devtoolsClient } from '~/composables/devtools-client'
import 'splitpanes/dist/splitpanes.css'

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

const optionRef = await fetchOptions()
watch(optionRef, (val) => {
  options.value = unref(val)
  val = { ...unref(val) }
  delete val.path
  delete val.cache
  delete val.cacheTtl
  delete val.component
  delete val.provider
  optionsEditor.value = val
}, {
  immediate: true,
})

const setPath = useDebounceFn((e) => {
  path.value = e.target.value
  refreshSources()
}, 1000)

const mode = useColorMode()

function updateProps(props: Record<string, any>) {
  optionsOverrides.value = props
  propsEdited.value = true
  refreshSources()
}

const isDark = computed(() => {
  return mode.value === 'dark'
})

async function resetProps(fetch = true) {
  if (fetch)
    await fetchOptions()
  optionsOverrides.value = {}
  propsEdited.value = false
  const cloned = { ...options.value }
  delete cloned.path
  delete cloned.cache
  delete cloned.cacheTtl
  delete cloned.component
  delete cloned.provider
  optionsEditor.value = cloned
  if (fetch)
    refreshSources()
}
await resetProps(false)
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
              Template HTML
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
      <div class="p-3 text-gray-400 text-sm text-center">
        v{{ version }}
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
      <div class="h-full max-h-full overflow-hidden lg:p-5 p-2" :style="{ width: containerWidth && constrainsWidth ? `${containerWidth}px` : '100%' }">
        <Splitpanes class="default-theme" @resize="slowRefreshSources">
          <Pane size="80">
            <NuxtPage />
          </Pane>
          <Pane size="20">
            <h2 class="font-semibold text-lg mb-5">
              Props
            </h2>
            <div class="relative">
              <JsonEditorVue
                :model-value="optionsEditor"
                :class="isDark ? ['jse-theme-dark'] : []"
                :main-menu-bar="false"
                :navigation-bar="false"
                @update:model-value="updateProps"
              />
              <span v-if="propsEdited" class="absolute top-1 right-1 text-10px ml-1 bg-blue-100 text-blue-700 px-1 py-2px rounded">modified</span>
            </div>
            <div v-if="propsEdited" class="text-xs p-2 text-gray-300">
              <div>
                Update {{ options.component }} to persist the changes. <button type="button" class="underline" @click="resetProps(true)">
                  Reset
                </button>
              </div>
            </div>
          </Pane>
        </Splitpanes>
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
.splitpanes.default-theme .splitpanes__pane {
  background-color: transparent !important;
}
.dark .splitpanes.default-theme .splitpanes__splitter {
  background-color: transparent !important;
  border-left: 1px solid rgba(156, 163, 175, 0.05);
  background-image: linear-gradient(rgba(0, 0, 0, 0), rgba(0, 0, 0, 0.05) 50%, rgba(0, 0, 0, 0));
}
.dark .splitpanes.default-theme .splitpanes__splitter:before, .splitpanes.default-theme .splitpanes__splitter:after {
  background-color: rgba(156, 163, 175, 0.3) !important;
}
</style>
