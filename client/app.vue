<script lang="ts" setup>
import 'floating-vue/dist/style.css'
import { useDebounceFn } from '@vueuse/core'
import JsonEditorVue from 'json-editor-vue'
import 'vanilla-jsoneditor/themes/jse-theme-dark.css'
import { Pane, Splitpanes } from 'splitpanes'
import { joinURL, parseURL, withQuery } from 'ufo'
import { ref } from 'vue'
import { version } from '../package.json'
import {
  base,
  containerWidth,
  description,
  host,
  options,
  optionsEditor,
  optionsOverrides,
  path,
  propsEdited,
  refreshSources,
  refreshTime,
  slowRefreshSources,
} from './util/logic'
import {
  computed,
  fetchPathDebug,
  highlight,
  unref,
  useColorMode,
  useHead,
  useRoute,
  watch,
} from '#imports'
import 'splitpanes/dist/splitpanes.css'
import { devtoolsClient } from '~/composables/rpc'
import { fetchGlobalDebug } from '~/composables/fetch'

useHead({
  title: 'OG Image Playground',
})

// await new Promise<void>((resolve) => {
//   watch(devtools, () => {
//     if (devtools.value)
//       resolve()
//   }, {
//     immediate: true,
//   })
// })
const { data: globalDebug } = fetchGlobalDebug()

const clientPath = computed(() => devtoolsClient.value?.host.nuxt.vueApp.config?.globalProperties?.$route?.path || undefined)
path.value = clientPath.value || useRoute().query.path as string || '/'
base.value = useRoute().query.base as string || '/'
watch(() => clientPath, (v) => {
  optionsOverrides.value = {}
  propsEdited.value = false
  path.value = v
})

const { data: debug } = fetchPathDebug()

const vnodes = computed(() => debug.value?.vnodes || [])

watch(debug, (val) => {
  if (!val)
    return
  options.value = unref(val.options)
  const _options = { ...unref(val.options) }
  delete _options.path
  delete _options.cache
  delete _options.socialPreview
  delete _options.cacheTtl
  delete _options.component
  delete _options.provider
  delete _options.componentHash
  optionsEditor.value = _options
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
  delete props.options
  optionsOverrides.value = props
  propsEdited.value = true
  refreshSources()
}

function patchProps(props: Record<string, any>) {
  delete props.options
  optionsOverrides.value = { ...optionsOverrides.value, ...props }
  propsEdited.value = true
  refreshSources()
}

const tab = ref('design')

const isDark = computed(() => {
  return mode.value === 'dark'
})

async function resetProps(fetch = true) {
  if (fetch)
    await fetchPathDebug()
  optionsOverrides.value = {}
  propsEdited.value = false
  const cloned = { ...options.value }
  delete cloned.path
  delete cloned.cache
  delete cloned.cacheTtl
  delete cloned.component
  delete cloned.socialPreview
  delete cloned.provider
  delete cloned.componentHash
  optionsEditor.value = cloned
  if (fetch)
    refreshSources()
}
await resetProps(false)

const height = options.value?.height || 630
const width = options.value?.width || 1200

const aspectRatio = width / height

const imageFormat = ref('png')
const socialPreview = ref('twitter')

const src = computed(() => {
  return withQuery(joinURL(host.value, '/__og-image__/image', path.value, `/og.${imageFormat.value}`), { timestamp: refreshTime.value, ...optionsOverrides.value })
})

const socialPreviewTitle = computed(() => {
  if (socialPreview.value === 'twitter' && options.value?.socialPreview?.twitter?.title)
    return options.value?.socialPreview?.twitter.title
  return options.value?.socialPreview?.og.title
})

const socialPreviewDescription = computed(() => {
  if (socialPreview.value === 'twitter' && options.value?.socialPreview?.twitter?.description)
    return options.value?.socialPreview?.twitter.description
  return options.value?.socialPreview?.og.description
})

const socialSiteUrl = computed(() => {
  // need to turn this URL into just an origin
  return parseURL(debug.value?.siteConfig?.url || '/').host || debug.value?.siteConfig?.url
})
const slackSocialPreviewSiteName = computed(() => {
  return options.value?.socialPreview?.og.site_name || socialSiteUrl.value
})

function toggleSocialPreview(preview: string) {
  if (preview === socialPreview.value)
    socialPreview.value = ''
  else
    socialPreview.value = preview
}

const activeComponentName = computed(() => {
  return optionsOverrides.value?.component || options.value?.component || 'OgImageFallback'
})

const renderer = computed(() => {
  return optionsOverrides.value?.provider || options.value?.provider || 'satori'
})

const componentNames = computed<{ pascalName: string }[]>(() => {
  const components = globalDebug.value?.componentNames || []
  return [
    components.find(name => name.pascalName === activeComponentName.value),
    // filter out the current component
    ...components.filter(name => name.pascalName !== activeComponentName.value),
  ].filter(Boolean)
})

const sidePanelOpen = ref(true)
const isLoading = ref(false)

function generateLoadTime(time: number) {
  const extension = imageFormat.value.toUpperCase()
  let rendererLabel = ''
  switch (imageFormat.value) {
    case 'png':
      rendererLabel = renderer.value === 'satori' ? 'Satori and ReSVG' : 'Chromium'
      break
    case 'svg':
      rendererLabel = 'Satori'
      break
  }
  isLoading.value = false
  description.value = `Generated ${extension} ${rendererLabel ? `with ${rendererLabel}` : ''} in ${time}ms.`
}
watch([imageFormat, renderer, optionsOverrides], () => {
  description.value = 'Loading...'
  isLoading.value = true
})

function openComponent(component: { path: string }) {
  devtoolsClient.value?.devtools.rpc.openInEditor(component.path)
}
</script>

<template>
  <div class="relative n-bg-base flex flex-col">
    <header class="sticky top-0 z-2 px-4 pt-4">
      <div class="flex justify-between items-start" mb2>
        <div class="flex space-x-5">
          <h1 text-xl flex items-center gap-2>
            <NIcon icon="carbon:image-search" class="text-blue-300" />
            Nuxt OG Image <NBadge class="text-sm">
              {{ version }}
            </NBadge>
          </h1>
        </div>
        <div class="flex items-center space-x-3 text-xl">
          <fieldset
            class="n-select-tabs flex flex-inline flex-wrap items-center border n-border-base rounded-lg n-bg-base"
          >
            <label
              v-for="(value, idx) of ['design', 'debug', 'docs']"
              :key="idx"
              class="relative n-border-base hover:n-bg-active cursor-pointer"
              :class="[
                idx ? 'border-l n-border-base ml--1px' : '',
                value === tab ? 'n-bg-active' : '',
              ]"
            >
              <div v-if="value === 'design'" :class="[value === tab ? '' : 'op35']">
                <VTooltip>
                  <div class="px-5 py-2">
                    <h2 text-lg flex items-center>
                      <NIcon icon="carbon:brush-freehand opacity-50" />
                    </h2>
                  </div>
                  <template #popper>
                    Design
                  </template>
                </VTooltip>
              </div>
              <div v-else-if="value === 'debug'" :class="[value === tab ? '' : 'op35']">
                <VTooltip>
                  <div class="px-5 py-2">
                    <h2 text-lg flex items-center>
                      <NIcon icon="carbon:debug opacity-50" />
                    </h2>
                  </div>
                  <template #popper>
                    Debug
                  </template>
                </VTooltip>
              </div>
              <div v-else-if="value === 'docs'" :class="[value === tab ? '' : 'op35']">
                <VTooltip>
                  <div class="px-5 py-2">
                    <h2 text-lg flex items-center>
                      <NIcon icon="carbon:book opacity-50" />
                    </h2>
                  </div>
                  <template #popper>
                    Documentation
                  </template>
                </VTooltip>
              </div>
              <input
                v-model="tab"
                type="radio"
                :value="value"
                :title="value"
                class="absolute cursor-pointer pointer-events-none inset-0 op-0.1"
              >
            </label>
          </fieldset>
          <VTooltip>
            <button text-lg="" type="button" class="n-icon-button n-button n-transition n-disabled:n-disabled" @click="refreshSources">
              <NIcon icon="carbon:reset" class="group-hover:text-green-500" />
            </button>
            <template #popper>
              Refresh
            </template>
          </VTooltip>
          <VTooltip>
            <button text-lg="" type="button" class="n-icon-button n-button n-transition n-disabled:n-disabled" @click="sidePanelOpen = !sidePanelOpen">
              <div v-if="sidePanelOpen" class="n-icon carbon:side-panel-open" />
              <div v-else class="n-icon carbon:open-panel-right" />
            </button>
            <template #popper>
              Toggle Sidebar
            </template>
          </VTooltip>
        </div>
        <div class="flex items-center space-x-3">
          <div class="opacity-80 text-sm">
            <NLink href="https://github.com/sponsors/harlan-zw" target="_blank">
              <NIcon icon="carbon:favorite" class="mr-[2px]" />
              Sponsor
            </NLink>
          </div>
          <div class="opacity-80 text-sm">
            <NLink href="https://github.com/harlan-zw/nuxt-og-image" target="_blank">
              <NIcon icon="logos:github-icon" class="mr-[2px]" />
              Submit an issue
            </NLink>
          </div>
          <a href="https://nuxtseo.com" target="_blank" class="flex items-end gap-1.5 font-semibold text-xl dark:text-white font-title">
            <NuxtSeoLogo />
            <span class="hidden sm:block">Nuxt</span><span class="sm:text-green-500 dark:sm:text-green-400">SEO</span>
          </a>
        </div>
      </div>
    </header>
    <div class="flex-row flex p4 h-full" style="min-height: calc(100vh - 64px);">
      <main class="mx-auto flex flex-col w-full bg-white dark:bg-black dark:bg-dark-700 bg-light-200 ">
        <div v-if="tab === 'design'" class="h-full relative max-h-full" :style="{ width: containerWidth && constrainsWidth ? `${containerWidth}px` : '100%' }">
          <Splitpanes class="default-theme" @resize="slowRefreshSources">
            <Pane size="60" class="flex h-full justify-center items-center relative n-panel-grids-center" style="padding-top: 30px;">
              <div class="flex justify-between text-sm w-full absolute top-0 left-0 pr-4">
                <div class="flex items-center text-lg space-x-1">
                  <NButton icon="carbon:png" :border="imageFormat === 'png'" @click="imageFormat = 'png'" />
                  <NButton v-if="renderer !== 'browser'" icon="carbon:svg" :border="imageFormat === 'svg'" @click="imageFormat = 'svg'" />
                  <NButton v-if="renderer === 'browser'" icon="carbon:jpg" :border="imageFormat === 'jpg'" @click="imageFormat = 'jpg'" />
                  <NButton icon="carbon:html" :border="imageFormat === 'html'" @click="imageFormat = 'html'" />
                </div>
                <div class="flex items-center">
                  <NButton icon="logos:twitter" :border="socialPreview === 'twitter'" @click="toggleSocialPreview('twitter')" />
                  <!--                  <NButton icon="logos:facebook" :border="socialPreview === 'facebook'" @click="socialPreview = 'facebook'" /> -->
                  <NButton icon="logos:slack-icon" :border="socialPreview === 'slack'" @click="toggleSocialPreview('slack')" />
                <!--                  <NButton icon="logos:whatsapp-icon" :border="socialPreview === 'discord'" @click="socialPreview = 'discord'" /> -->
                </div>
              </div>
              <TwitterCardRenderer v-if="socialPreview === 'twitter'">
                <template #domain>
                  {{ socialSiteUrl }}
                </template>
                <ImageLoader
                  v-if="imageFormat !== 'html'"
                  :src="src"
                  :aspect-ratio="aspectRatio"
                  @load="generateLoadTime"
                  @refresh="refreshSources"
                />
                <IFrameLoader
                  v-else
                  :src="src"
                  :aspect-ratio="aspectRatio"
                  @load="generateLoadTime"
                  @refresh="refreshSources"
                />
              </TwitterCardRenderer>
              <SlackCardRenderer v-else-if="socialPreview === 'slack'">
                <template #favIcon>
                  <img :src="`${socialSiteUrl?.includes('localhost') ? 'http' : 'https'}://${socialSiteUrl}/favicon.ico`">
                </template>
                <template #siteName>
                  {{ slackSocialPreviewSiteName }}
                </template>
                <template #title>
                  {{ socialPreviewTitle }}
                </template>
                <template #description>
                  {{ socialPreviewDescription }}
                </template>
                <ImageLoader
                  v-if="imageFormat !== 'html'"
                  :src="src"
                  :aspect-ratio="aspectRatio"
                  @load="generateLoadTime"
                  @refresh="refreshSources"
                />
                <IFrameLoader
                  v-else
                  :src="src"
                  :aspect-ratio="aspectRatio"
                  @load="generateLoadTime"
                  @refresh="refreshSources"
                />
              </SlackCardRenderer>
              <div v-else>
                <div>
                  <ImageLoader
                    v-if="imageFormat !== 'html'"
                    :src="src"
                    :aspect-ratio="aspectRatio"
                    @load="generateLoadTime"
                    @refresh="refreshSources"
                  />
                  <IFrameLoader
                    v-else
                    :src="src"
                    :aspect-ratio="aspectRatio"
                    @load="generateLoadTime"
                    @refresh="refreshSources"
                  />
                </div>
              </div>
              <div v-if="description" class="mt-3 text-sm opacity-50 absolute bottom-3">
                {{ description }}
              </div>
            </Pane>
            <Pane v-if="sidePanelOpen" size="40">
              <OSectionBlock>
                <template #text>
                  <h3 class="opacity-80 text-base mb-1">
                    <Icon name="carbon:gui-management" class="mr-1" />
                    Renderer
                  </h3>
                </template>
                <div class="flex items-center space-x-2 text-sm">
                  <NButton icon="logos:vercel-icon" :border="renderer === 'satori'" @click="renderer === 'browser' && patchProps({ provider: 'satori' })">
                    Satori
                  </NButton>
                  <NButton icon="carbon:drop-photo" :border="renderer === 'browser'" @click="renderer === 'satori' && patchProps({ provider: 'browser' })">
                    Browser
                  </NButton>
                </div>
              </OSectionBlock>
              <OSectionBlock>
                <template #text>
                  <h3 class="opacity-80 text-base mb-1">
                    <NIcon icon="carbon:template" class="mr-1" />
                    Component
                  </h3>
                </template>
                <div class="flex flex-nowrap overflow-x-auto space-x-3 p2" style="-webkit-overflow-scrolling: touch; -ms-overflow-style: -ms-autohiding-scrollbar;">
                  <NLoading v-if="isLoading" />
                  <button v-for="name in componentNames" v-else :key="name.pascalName" class="!p-0" :class="name.pascalName === activeComponentName ? [] : ['opacity-75 hover:opacity-100']" @click="patchProps({ component: name.pascalName })">
                    <div>
                      <VTooltip>
                        <div class="w-[228px] h-[120px] relative">
                          <ImageLoader
                            :src="withQuery(src, { component: name.pascalName })"
                            :aspect-ratio="aspectRatio"
                            class="rounded overflow-hidden"
                            :class="name.pascalName === activeComponentName ? ['ring-2 ring-green-500'] : []"
                            @refresh="refreshSources"
                          />
                          <button class="absolute z-2 top-2 right-2 hover:bg-white transition-all bg-white/50 px-1 py-2px rounded text-sm" @click.stop="openComponent(name)">
                            <NIcon icon="carbon:launch" />
                          </button>
                        </div>
                        <template #popper>
                          {{ name.pascalName }}
                        </template>
                      </VTooltip>
                    </div>
                  </button>
                </div>
              </OSectionBlock>
              <OSectionBlock>
                <template #text>
                  <h3 class="opacity-80 text-base mb-1">
                    <Icon name="carbon:operations-record" class="mr-1" />
                    Props
                  </h3>
                </template>
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
              </OSectionBlock>
            </Pane>
          </Splitpanes>
        </div>
        <div v-else-if="tab === 'debug'" class="h-full max-h-full overflow-hidden">
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
          <OSectionBlock>
            <template #text>
              <h3 class="opacity-80 text-base mb-1">
                <NIcon icon="carbon:settings" class="mr-1" />
                Runtime Config
              </h3>
            </template>
            <div class="px-3 py-2 space-y-5">
              <pre of-auto h-full text-sm style="white-space: break-spaces;" v-html="highlight(JSON.stringify(globalDebug?.runtimeConfig || {}, null, 2), 'json')" />
            </div>
          </OSectionBlock>
        </div>
        <div v-else-if="tab === 'docs'" class="h-full max-h-full overflow-hidden">
          <iframe src="https://nuxtseo.com/og-image" class="w-full h-full border-none" style="min-height: calc(100vh - 100px);" />
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
/* Overrides Floating Vue */
.v-popper--theme-dropdown .v-popper__inner,
.v-popper--theme-tooltip .v-popper__inner {
  --at-apply: bg-base text-black dark:text-white rounded border border-base shadow;
  box-shadow: 0 6px 30px #0000001a;
  background-color: white;
}

.v-popper--theme-tooltip .v-popper__arrow-inner,
.v-popper--theme-dropdown .v-popper__arrow-inner {
  visibility: visible;
  --at-apply: border-white dark:border-hex-121212;
}

.v-popper--theme-tooltip .v-popper__arrow-outer,
.v-popper--theme-dropdown .v-popper__arrow-outer {
  --at-apply: border-base;
}

.v-popper--theme-tooltip.v-popper--shown,
.v-popper--theme-tooltip.v-popper--shown * {
  transition: none !important;
}

header {
  -webkit-backdrop-filter: blur(2px);
  backdrop-filter: blur(2px);
  background-color: #fffc;
}
</style>
