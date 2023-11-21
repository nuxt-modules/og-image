<script lang="ts" setup>
import { useDebounceFn } from '@vueuse/core'
import JsonEditorVue from 'json-editor-vue'
import 'vanilla-jsoneditor/themes/jse-theme-dark.css'
import { Pane, Splitpanes } from 'splitpanes'
import {
  base,
  containerWidth, description,
  options,
  optionsEditor,
  optionsOverrides,
  path,
  propsEdited,
  refreshSources,
  slowRefreshSources,
} from './util/logic'
import {
  computed,
  devtools,
  fetchOptions,
  fetchVNodes,
  highlight,
  unref,
  useColorMode,
  useHead,
  useRoute,
  watch
} from '#imports'
import 'splitpanes/dist/splitpanes.css'
import { version } from '../package.json'
import { ref } from 'vue'
import { devtoolsClient } from '~/composables/rpc'

useHead({
  title: 'OG Image Playground',
})

await new Promise<void>((resolve) => {
  watch(devtools, () => {
    if (devtools.value)
      resolve()
  }, {
    immediate: true,
  })
})

const clientPath = computed(() => devtoolsClient.value?.host.nuxt.vueApp.config?.globalProperties?.$route?.path || undefined)
path.value = clientPath.value || useRoute().query.path as string || '/'
base.value = useRoute().query.base as string || '/'
watch(() => clientPath, (v) => {
  optionsOverrides.value = {}
  propsEdited.value = false
  path.value = v
})

const vnodes = await fetchVNodes()

const optionRef = await fetchOptions()
watch(optionRef, (val) => {
  options.value = unref(val)
  val = { ...unref(val) }
  delete val.path
  delete val.cache
  delete val.cacheTtl
  delete val.component
  delete val.provider
  delete val.componentHash
  optionsEditor.value = val
}, {
  immediate: true,
})

const setPath = useDebounceFn((e) => {
  optionsOverrides.value = {}
  propsEdited.value = false
  path.value = e.target.value
  refreshSources()
}, 1000)

const mode = useColorMode()

function updateProps(props: Record<string, any>) {
  optionsOverrides.value = props
  propsEdited.value = true
  refreshSources()
}

const tab = ref('design')

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
  delete cloned.componentHash
  optionsEditor.value = cloned
  if (fetch)
    refreshSources()
}
await resetProps(false)
</script>

<template>
  <div class="relative p8 n-bg-base flex flex-col h-screen">
    <div>
      <div class="flex justify-between items-center" mb6>
        <div>
          <h1 text-xl mb2 flex items-center gap-2>
            <NIcon icon="carbon:image-search" class="text-blue-300" />
            Nuxt OG Image <NBadge class="text-sm">
              {{ version }}
            </NBadge>
          </h1>
          <div class="space-x-3 mt-1 ml-1 opacity-80 text-sm">
            <NLink href="https://nuxtseo.com/og-image" target="_blank">
              <NuxtSeoLogo class="mr-[2px] w-5 h-5 inline" />
              Documentation
            </NLink>
            <NLink href="https://github.com/harlan-zw/nuxt-og-image" target="_blank">
              <NIcon icon="logos:github-icon" class="mr-[2px]" />
              Submit an issue
            </NLink>
          </div>
        </div>
        <div>
          <a href="https://nuxtseo.com" target="_blank" class="flex items-end gap-1.5 font-semibold text-xl dark:text-white font-title">
            <NuxtSeoLogo />
            <span class="hidden sm:block">Nuxt</span><span class="sm:text-green-500 dark:sm:text-green-400">SEO</span>
          </a>
        </div>
      </div>
    </div>
    <div class="mb-6 text-xl">
      <fieldset
        class="n-select-tabs flex flex-inline flex-wrap items-center border n-border-base rounded-lg n-bg-base"
      >
        <label
          v-for="(value, idx) of ['design', 'debug']"
          :key="idx"
          class="relative n-border-base hover:n-bg-active px-0.5em py-0.1em"
          :class="[
            idx ? 'border-l n-border-base ml--1px' : '',
            value === tab ? 'n-bg-active' : '',
          ]"
        >
          <div v-if="value === 'design'" :class="[value === tab ? '' : 'op35']">
            <div class="px-2 py-1">
              <h2 text-lg flex items-center gap-2 mb-1>
                <NIcon icon="carbon:brush-freehand opacity-50" />
                Design
              </h2>
              <p text-xs op60>
                Design your OG Image with Social Previews.
              </p>
            </div>
          </div>
          <div v-else-if="value === 'debug'" :class="[value === tab ? '' : 'op35']">
            <div class="px-2 py-1">
              <h2 text-lg flex items-center gap-2 mb-1>
                <NIcon icon="carbon:debug opacity-50" />
                Debug
              </h2>
              <p text-xs op60>
                Find out what might be going wrong.
              </p>
            </div>
          </div>
          <input
            v-model="tab"
            type="radio"
            :value="value"
            :title="value"
            class="absolute inset-0 op-0.1"
          >
        </label>
      </fieldset>
      <button
        class="ml-5 hover:shadow-lg text-xs transition items-center gap-2 inline-flex border-green-500/50 border-1 rounded-lg shadow-sm px-3 py-1"
        @click="refreshSources"
      >
        <div>
          Refresh Data
        </div>
      </button>
    </div>
    <div class="flex-row flex h-screen">
      <main class="mx-auto flex flex-col w-full bg-white dark:bg-black max-h-screen overflow-hidden dark:bg-dark-700 bg-light-200 ">
        <hr class="border-1 border-light-400 dark:border-dark-400">
        <div v-if="tab === 'design'" class="h-full max-h-full overflow-hidden lg:p-5 p-2" :style="{ width: containerWidth && constrainsWidth ? `${containerWidth}px` : '100%' }">
          <Splitpanes class="default-theme" @resize="slowRefreshSources">
            <Pane size="60">
              <NuxtPage />
            </Pane>
            <Pane size="40">
              <div class="px-3 pt-2">
                <div v-if="description" class="mb-3 opacity-80">{{ description }}</div>
                <h2 class="font-semibold text-lg mb-3">
                  <Icon name="carbon:operations-record" class="mr-1" />
                  Options
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
                <div v-if="propsEdited" class="text-xs p-2 opacity-80">
                  <div>
                    Update {{ options.component }} to persist the changes. <button type="button" class="underline" @click="resetProps(true)">
                      Reset
                    </button>
                  </div>
                </div>
              </div>
            </Pane>
          </Splitpanes>
        </div>
        <div v-else-if="tab === 'debug'" class="h-full max-h-full overflow-hidden lg:p-5 p-2">
          <OSectionBlock>
            <template #text>
              <h3 class="opacity-80 text-base mb-1">
                <NIcon icon="carbon:ibm-cloud-pak-manta-automated-data-lineage" class="mr-1" />
                vNodes
              </h3>
            </template>
            <div class="px-3 py-2 space-y-5">
              <pre of-auto h-full text-sm style="white-space: break-spaces;" v-html="highlight(JSON.stringify(vnodes, null, 2), 'json')" />
            </div>
          </OSectionBlock>
        </div>
      </main>
    </div>
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
