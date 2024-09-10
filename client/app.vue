<script lang="ts" setup>
import {
  colorMode,
  computed,
  fetchPathDebug,
  highlight,
  unref,
  useHead,
  watch,
} from '#imports'
import { useLocalStorage, useWindowSize } from '@vueuse/core'
import defu from 'defu'
import JsonEditorVue from 'json-editor-vue'
import { Pane, Splitpanes } from 'splitpanes'
import { joinURL, parseURL, withHttps, withQuery } from 'ufo'
import { ref } from 'vue'
import { fetchGlobalDebug } from '~/composables/fetch'
import { devtoolsClient } from '~/composables/rpc'
import { separateProps } from '../src/runtime/shared'
import {
  description,
  hasMadeChanges,
  host,
  options,
  optionsOverrides,
  path,
  propEditor,
  query,
  refreshSources,
  refreshTime,
  slowRefreshSources,
} from './util/logic'
import type { OgImageComponent, OgImageOptions } from '../src/runtime/types'
import 'floating-vue/dist/style.css'
import 'vanilla-jsoneditor/themes/jse-theme-dark.css'
import 'splitpanes/dist/splitpanes.css'

useHead({
  title: 'OG Image Playground',
})

const { data: globalDebug } = fetchGlobalDebug()

// const clientPath = computed(() => devtoolsClient.value?.host.nuxt.vueApp.config?.globalProperties?.$route?.path || undefined)
// path.value = clientPath.value || useRoute().query.path as string || '/'
// base.value = useRoute().query.base as string || '/'
// watch(() => clientPath, (v) => {
//   optionsOverrides.value = {}
//   propsEdited.value = false
//   path.value = v
// })

const emojis = ref('noto')

const debugAsyncData = fetchPathDebug()
const { data: debug, pending, error } = debugAsyncData

watch(debug, (val) => {
  if (!val)
    return
  options.value = separateProps(unref(val.options), ['socialPreview', 'options'])
  emojis.value = options.value.emojis
  propEditor.value = options.value.props
}, {
  immediate: true,
})

const isDark = computed(() => colorMode.value === 'dark')
useHead({
  htmlAttrs: {
    class: isDark.value ? 'dark' : '',
  },
})

function updateProps(props: Record<string, any>) {
  optionsOverrides.value = defu({ props }, optionsOverrides.value)
  hasMadeChanges.value = true
  refreshSources()
}

const tab = useLocalStorage('nuxt-og-image:tab', 'design')

function patchOptions(options: OgImageOptions) {
  tab.value = 'design'
  delete options.options
  optionsOverrides.value = defu(options, optionsOverrides.value)
  hasMadeChanges.value = true
  refreshSources()
}

async function resetProps(fetch = true) {
  if (fetch)
    await fetchPathDebug()
  optionsOverrides.value = {}
  hasMadeChanges.value = false
  if (fetch)
    refreshSources()
}
await resetProps(false)

const defaults = computed(() => {
  return globalDebug.value?.runtimeConfig.defaults || {
    height: 600,
    width: 1200,
  }
})

const height = computed(() => {
  return optionsOverrides.value?.height || options.value?.height || defaults.value.height
})

const width = computed(() => {
  return optionsOverrides.value?.width || options.value?.width || defaults.value.width
})

const aspectRatio = computed(() => {
  return width.value / height.value
})

const imageFormat = computed(() => {
  return optionsOverrides.value?.extension || options.value?.extension || 'png'
})
const socialPreview = useLocalStorage('nuxt-og-image:social-preview', 'twitter')

const src = computed(() => {
  // wait until we know what we're rendering
  if (!debug.value)
    return ''
  return withQuery(joinURL(host.value, '/__og-image__/image', path.value, `/og.${imageFormat.value}`), {
    timestamp: refreshTime.value,
    ...optionsOverrides.value,
    _query: query.value,
  })
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
  return parseURL(debug.value?.siteConfig?.url || '/').host || debug.value?.siteConfig?.url || '/'
})
const slackSocialPreviewSiteName = computed(() => {
  return options.value?.socialPreview?.og.site_name || socialSiteUrl.value
})

function toggleSocialPreview(preview?: string) {
  if (!preview || preview === socialPreview.value)
    socialPreview.value = ''
  else
    socialPreview.value = preview!
}

const activeComponentName = computed(() => {
  return optionsOverrides.value?.component || options.value?.component || 'NuxtSeo'
})

const renderer = computed(() => {
  return optionsOverrides.value?.renderer || options.value?.renderer || 'satori'
})

const componentNames = computed<OgImageComponent[]>(() => {
  const components = globalDebug.value?.componentNames || []
  return [
    components.find(name => name.pascalName === activeComponentName.value),
    // filter out the current component
    ...components.filter(name => name.pascalName !== activeComponentName.value),
  ].filter(Boolean)
})

const communityComponents = computed(() => {
  return componentNames.value.filter(c => c.category === 'community')
})
const appComponents = computed(() => {
  return componentNames.value.filter(c => c.category === 'app')
})

const windowSize = useWindowSize()
const sidePanelOpen = useLocalStorage('nuxt-og-image:side-panel-open', windowSize.width.value >= 1024)

// close side panel if it's too small
watch(windowSize.width, (v) => {
  if (v < 1024 && sidePanelOpen.value)
    sidePanelOpen.value = false
}, {
  immediate: true,
})

const isLoading = ref(false)

function generateLoadTime(payload: { timeTaken: string, sizeKb: string }) {
  const extension = (imageFormat.value || '').toUpperCase()
  let rendererLabel = ''
  switch (imageFormat.value) {
    case 'png':
      rendererLabel = renderer.value === 'satori' ? 'Satori and ReSVG' : 'Chromium'
      break
    case 'jpeg':
    case 'jpg':
      rendererLabel = renderer.value === 'satori' ? 'Satori, ReSVG and Sharp' : 'Chromium'
      break
    case 'svg':
      rendererLabel = 'Satori'
      break
  }
  isLoading.value = false
  if (extension !== 'HTML')
    description.value = `Generated ${width.value}x${height.value} ${payload.sizeKb ? `${payload.sizeKb}kB` : ''} ${extension} ${rendererLabel ? `with ${rendererLabel}` : ''} in ${payload.timeTaken}ms.`
  else
    description.value = ''
}
watch([renderer, optionsOverrides], () => {
  description.value = 'Loading...'
  isLoading.value = true
})

function openImage() {
  // open new tab to source
  window.open(src.value, '_blank')
}

const pageFile = computed(() => {
  return devtoolsClient.value?.host.nuxt.vueApp.config?.globalProperties?.$route.matched[0].components?.default.__file
})
function openCurrentPageFile() {
  devtoolsClient.value?.devtools.rpc.openInEditor(pageFile.value)
}

function openCurrentComponent() {
  const component = componentNames.value.find(c => c.pascalName === activeComponentName.value)
  devtoolsClient.value?.devtools.rpc.openInEditor(component.path)
}

const isPageScreenshot = computed(() => {
  return activeComponentName.value === 'PageScreenshot'
})

watch(emojis, (v) => {
  if (v !== options.value?.emojis) {
    patchOptions({
      emojis: v,
    })
  }
})

const currentPageFile = computed(() => {
  const path = devtoolsClient.value?.host.nuxt.vueApp.config?.globalProperties?.$route.matched[0].components?.default.__file
  // get the path only from the `pages/<path>`
  return `pages/${path?.split('pages/')[1]}`
})
</script>

<template>
  <div class="relative n-bg-base flex flex-col">
    <header class="sticky top-0 z-2 px-4 pt-4">
      <div class="flex justify-between items-start" mb2>
        <div class="flex space-x-5">
          <h1 text-xl flex items-center gap-2>
            <NIcon icon="carbon:image-search" class="text-blue-300" />
            OG Image <NBadge class="text-sm">
              {{ globalDebug?.runtimeConfig?.version }}
            </NBadge>
          </h1>
        </div>
        <div class="flex items-center space-x-3 text-xl">
          <fieldset
            class="n-select-tabs flex flex-inline flex-wrap items-center border n-border-base rounded-lg n-bg-base"
          >
            <label
              v-for="(value, idx) of ['design', 'templates', 'debug', 'docs']"
              :key="idx"
              class="relative n-border-base hover:n-bg-active cursor-pointer"
              :class="[
                idx ? 'border-l n-border-base ml--1px' : '',
                value === tab ? 'n-bg-active' : '',
                isPageScreenshot && value === 'templates' ? 'hidden' : '',
                (pending || error ? 'n-disabled' : ''),
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
              <div v-if="value === 'templates'" :class="[value === tab ? '' : 'op35']">
                <VTooltip>
                  <div class="px-5 py-2">
                    <h2 text-lg flex items-center>
                      <NIcon icon="carbon:image opacity-50" />
                    </h2>
                  </div>
                  <template #popper>
                    Templates
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
        </div>
        <div class="items-center space-x-3 hidden lg:flex">
          <div class="opacity-80 text-sm">
            <NLink href="https://github.com/sponsors/harlan-zw" target="_blank">
              <NIcon icon="carbon:favorite" class="mr-[2px]" />
              Sponsor
            </NLink>
          </div>
          <div class="opacity-80 text-sm">
            <NLink href="https://github.com/nuxt-modules/og-image" target="_blank">
              <NIcon icon="logos:github-icon" class="mr-[2px]" />
              Submit an issue
            </NLink>
          </div>
          <a href="https://nuxtseo.com" target="_blank" class="flex items-end gap-1.5 font-semibold text-xl dark:text-white font-title">
            <NuxtSeoLogo />
          </a>
        </div>
      </div>
    </header>
    <div class="flex-row flex p4 h-full" style="min-height: calc(100vh - 64px);">
      <main class="mx-auto flex flex-col w-full bg-white dark:bg-black dark:bg-dark-700 bg-light-200 ">
        <div v-if="tab === 'design'" class="h-full relative max-h-full">
          <div v-if="error">
            <div v-if="error.message.includes('missing the Nuxt OG Image payload')">
              <!-- nicely tell the user they should use defineOgImage to get started -->
              <div class="flex flex-col items-center justify-center mx-auto max-w-135 h-85vh">
                <div class="">
                  <h2 class="text-2xl font-semibold mb-3">
                    <NIcon icon="carbon:information" class="text-blue-500" />
                    Oops! Did you forget <code>defineOgImage()</code>?
                  </h2>
                  <p class="text-lg opacity-80 my-3">
                    Getting started with Nuxt OG Image is easy, simply add the <code>defineOgImage()</code> within setup script setup of your <code class="underline cursor-pointer" @click="openCurrentPageFile">{{ currentPageFile }}</code> file.
                  </p>
                  <p class="text-lg opacity-80">
                    <a href="https://nuxtseo.com/og-image/getting-started/getting-familar-with-nuxt-og-image" target="_blank" class="underline">
                      Learn more
                    </a>
                  </p>
                </div>
              </div>
            </div>
            <div v-else>
              {{ error }}
            </div>
          </div>
          <Splitpanes v-else class="default-theme" @resize="slowRefreshSources">
            <Pane size="60" class="flex h-full justify-center items-center relative n-panel-grids-center pr-4" style="padding-top: 30px;">
              <div class="flex justify-between items-center text-sm w-full absolute pr-[30px] top-0 left-0">
                <div class="flex items-center text-lg space-x-1 w-[100px]">
                  <NButton v-if="!!globalDebug?.compatibility?.sharp || renderer === 'chromium'" icon="carbon:jpg" :border="imageFormat === 'jpeg' || imageFormat === 'jpg'" @click="patchOptions({ extension: 'jpg' })" />
                  <NButton icon="carbon:png" :border="imageFormat === 'png'" @click="patchOptions({ extension: 'png' })" />
                  <NButton v-if="renderer !== 'chromium'" icon="carbon:svg" :border="imageFormat === 'svg'" @click="patchOptions({ extension: 'svg' })" />
                  <NButton v-if="!isPageScreenshot" icon="carbon:html" :border="imageFormat === 'html'" @click="patchOptions({ extension: 'html' })" />
                </div>
                <div class="text-xs">
                  <div v-if="!isPageScreenshot" class="opacity-70 space-x-1 hover:opacity-90 transition cursor-pointer" @click="openCurrentComponent">
                    <span>{{ activeComponentName.replace('OgImage', '') }}</span>
                    <span class="underline">View source</span>
                  </div>
                  <div v-else>
                    Screenshot of the current page.
                  </div>
                </div>
                <div class="flex items-center w-[100px]">
                  <NButton icon="carbon:drag-horizontal" :border="!socialPreview" @click="toggleSocialPreview()" />
                  <NButton icon="logos:twitter" :border="socialPreview === 'twitter'" @click="toggleSocialPreview('twitter')" />
                  <!--                  <NButton icon="logos:facebook" :border="socialPreview === 'facebook'" @click="socialPreview = 'facebook'" /> -->
                  <NButton icon="logos:slack-icon" :border="socialPreview === 'slack'" @click="toggleSocialPreview('slack')" />
                  <!--                  <NButton icon="logos:whatsapp-icon" :border="socialPreview === 'discord'" @click="socialPreview = 'discord'" /> -->
                  <VTooltip>
                    <button text-lg="" type="button" class=" n-icon-button n-button n-transition n-disabled:n-disabled" @click="sidePanelOpen = !sidePanelOpen">
                      <div v-if="sidePanelOpen" class="n-icon carbon:side-panel-open" />
                      <div v-else class="n-icon carbon:open-panel-right" />
                    </button>
                    <template #popper>
                      Toggle Sidebar
                    </template>
                  </VTooltip>
                </div>
              </div>
              <TwitterCardRenderer v-if="socialPreview === 'twitter'" :title="socialPreviewTitle">
                <template #domain>
                  <a target="_blank" :href="withHttps(socialSiteUrl)">From {{ socialSiteUrl }}</a>
                </template>
                <ImageLoader
                  v-if="imageFormat !== 'html'"
                  :src="src"
                  :aspect-ratio="aspectRatio"
                  @load="generateLoadTime"
                  @click="openImage"
                  @refresh="refreshSources"
                />
                <IFrameLoader
                  v-else
                  :src="src"
                  max-height="300"
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
                  class="!h-[300px]"
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
              <div v-else class="w-full h-full">
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
              <div v-if="description" class="mt-3 text-sm opacity-50 absolute bottom-3">
                {{ description }}
              </div>
            </Pane>
            <Pane v-if="sidePanelOpen" size="40">
              <div v-if="hasMadeChanges" class="text-sm p-2 opacity-80">
                <div>
                  You are previewing changes, you'll need to update your <code>defineOgImage</code> to persist them.
                  <NButton type="button" class="underline" @click="resetProps(true)">
                    Reset
                  </NButton>
                </div>
              </div>
              <OSectionBlock>
                <template #text>
                  <h3 class="opacity-80 text-base mb-1">
                    <NIcon name="carbon:gui-management" class="mr-1" />
                    Render
                  </h3>
                </template>
                <div class="flex space-between">
                  <div class="flex flex-grow items-center space-x-2 text-sm">
                    <NButton v-if="!!globalDebug?.compatibility?.satori && !isPageScreenshot" icon="logos:vercel-icon" :border="renderer === 'satori'" @click="patchOptions({ renderer: 'satori' })">
                      Satori
                    </NButton>
                    <NButton v-if="!!globalDebug?.compatibility?.chromium" icon="logos:chrome" :border="renderer === 'chromium'" @click="patchOptions({ renderer: 'chromium' })">
                      Chromium
                    </NButton>
                  </div>
                  <div v-if="!isPageScreenshot" class="flex items-center text-sm space-x-2">
                    <label for="emojis">Emojis</label>
                    <NSelect id="emojis" v-model="emojis">
                      <option value="noto">
                        Noto
                      </option>
                      <option value="noto-v1">
                        Noto v1
                      </option>
                      <option value="twemoji">
                        Twitter Emoji
                      </option>
                      <option value="fluent-emoji">
                        Fluent Emoji
                      </option>
                      <option value="fluent-emoji-flat">
                        Fluent Emoji Flat
                      </option>
                      <option value="emojione">
                        Emojione
                      </option>
                      <option value="emojione-v1">
                        Emojione v1
                      </option>
                      <option value="streamline-emojis">
                        Streamline Emojis
                      </option>
                      <option value="openmoji">
                        Openmoji
                      </option>
                    </NSelect>
                  </div>
                </div>
              </OSectionBlock>
              <OSectionBlock v-if="!isPageScreenshot">
                <template #text>
                  <h3 class="opacity-80 text-base mb-1">
                    <NIcon name="carbon:operations-record" class="mr-1" />
                    Props
                  </h3>
                </template>
                <div class="relative">
                  <JsonEditorVue
                    :model-value="propEditor"
                    :class="isDark ? ['jse-theme-dark'] : []"
                    :main-menu-bar="false"
                    :navigation-bar="false"
                    @update:model-value="updateProps"
                  />
                  <span v-if="hasMadeChanges" class="absolute top-1 right-1 text-10px ml-1 bg-blue-100 text-blue-700 px-1 py-2px rounded">modified</span>
                </div>
              </OSectionBlock>
              <OSectionBlock>
                <template #text>
                  <h3 class="opacity-80 text-base mb-1">
                    <NIcon icon="carbon:checkmark-filled-warning" class="mr-1" />
                    Compatibility
                  </h3>
                </template>
                <div v-if="debug?.compatibilityHints" class="text-sm">
                  <div v-if="!debug.compatibilityHints.length" class="text-sm">
                    <NIcon icon="carbon:checkmark" class="text-green-500" /> Looks good.
                  </div>
                  <div v-else class="space-y-3">
                    <div v-for="(c, key) in debug.compatibilityHints" :key="key" class="space-x-2 flex items-center opacity-65">
                      <NIcon icon="carbon:warning" class="text-yellow-500" />
                      <div>{{ c }}</div>
                    </div>
                  </div>
                  <div class="mt-5 text-center opacity-75">
                    See the <NuxtLink target="_blank" to="https://nuxtseo.com/og-image/guides/compatibility" class="underline">
                      compatibility guide
                    </NuxtLink> to learn more.
                  </div>
                </div>
              </OSectionBlock>
            </Pane>
          </Splitpanes>
        </div>
        <div v-else-if="tab === 'templates'" class="h-full max-h-full overflow-hidden space-y-5">
          <NLoading v-if="isLoading" />
          <div v-else>
            <OSectionBlock v-if="appComponents.length">
              <template #text>
                <h3 class="opacity-80 text-base mb-1">
                  <NIcon name="carbon:app" class="mr-1" />
                  App Templates
                </h3>
              </template>
              <NTip>These are the OG Image templates that belong to your project.</NTip>
              <div class="flex flex-nowrap overflow-x-auto space-x-3 p2" style="-webkit-overflow-scrolling: touch; -ms-overflow-style: -ms-autohiding-scrollbar;">
                <button v-for="name in appComponents" :key="name.pascalName" class="!p-0" @click="patchOptions({ component: name.pascalName })">
                  <TemplateComponentPreview
                    :component="name"
                    :src="withQuery(src, { component: name.pascalName })"
                    :aspect-ratio="aspectRatio"
                    :active="name.pascalName === activeComponentName"
                  />
                </button>
              </div>
            </OSectionBlock>
            <OSectionBlock>
              <template #text>
                <h3 class="opacity-80 text-base mb-1">
                  <NIcon name="carbon:airline-passenger-care" class="mr-1" />
                  Community Templates
                </h3>
              </template>
              <NTip>These are OG Image templates created by the community.<br>You can try them out by clicking on them, when you find one you like, view the source and copy+paste.</NTip>
              <div class="flex flex-nowrap overflow-x-auto space-x-3 p2" style="-webkit-overflow-scrolling: touch; -ms-overflow-style: -ms-autohiding-scrollbar;">
                <button v-for="name in communityComponents" :key="name.pascalName" class="!p-0" @click="patchOptions({ component: name.pascalName })">
                  <TemplateComponentPreview
                    :component="name"
                    :src="withQuery(src, { component: name.pascalName })"
                    :aspect-ratio="aspectRatio"
                    :active="name.pascalName === activeComponentName"
                  />
                </button>
              </div>
            </OSectionBlock>
          </div>
        </div>
        <div v-else-if="tab === 'debug'" class="h-full max-h-full overflow-hidden">
          <OSectionBlock>
            <template #text>
              <h3 class="opacity-80 text-base mb-1">
                <NIcon icon="carbon:settings" class="mr-1" />
                Compatibility
              </h3>
            </template>
            <div class="px-3 py-2 space-y-5">
              <pre of-auto h-full text-sm style="white-space: break-spaces;" v-html="highlight(JSON.stringify(globalDebug?.compatibility || {}, null, 2), 'json')" />
            </div>
          </OSectionBlock>
          <OSectionBlock>
            <template #text>
              <h3 class="opacity-80 text-base mb-1">
                <NIcon icon="carbon:ibm-cloud-pak-manta-automated-data-lineage" class="mr-1" />
                vNodes
              </h3>
            </template>
            <div class="px-3 py-2 space-y-5">
              <pre of-auto h-full text-sm style="max-height: 500px; overflow-y: auto; white-space: break-spaces;" v-html="highlight(JSON.stringify(debug?.vnodes || {}, null, 2), 'json')" />
            </div>
          </OSectionBlock>
          <OSectionBlock>
            <template #text>
              <h3 class="opacity-80 text-base mb-1">
                <NIcon icon="carbon:ibm-cloud-pak-manta-automated-data-lineage" class="mr-1" />
                SVG
              </h3>
            </template>
            <div class="px-3 py-2 space-y-5">
              <pre of-auto h-full text-sm style="max-height: 500px; overflow-y: auto; white-space: break-spaces;" v-html="highlight(debug?.svg.replaceAll('>', '>\n') || '', 'html')" />
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

header {
  -webkit-backdrop-filter: blur(2px);
  backdrop-filter: blur(2px);
  background-color: #fffc;
}

.dark header {
  background-color: #111c;
}

html {
  --at-apply: font-sans;
  overflow-y: scroll;
  overscroll-behavior: none;
  -ms-overflow-style: none;  /* IE and Edge */
  scrollbar-width: none;  /* Firefox */
}
body::-webkit-scrollbar {
  display: none;
}
body {
  /* trap scroll inside iframe */
  height: calc(100vh + 1px);
}

html.dark {
  background: #111;
  color-scheme: dark;
}

/* Markdown */
.n-markdown a {
  --at-apply: text-primary hover:underline;
}
.prose a {
  --uno: hover:text-primary;
}
.prose code::before {
  content: ""
}
.prose code::after {
  content: ""
}
.prose hr {
  --uno: border-solid border-1 border-b border-base h-1px w-full block my-2 op50;
}

.dark .shiki {
  background: var(--shiki-dark-bg, inherit) !important;
}

.dark .shiki span {
  color: var(--shiki-dark, inherit) !important;
}

/* JSON Editor */
textarea {
  background: #8881
}

:root {
  --jse-theme-color: #fff !important;
  --jse-text-color-inverse: #777 !important;
  --jse-theme-color-highlight: #eee !important;
  --jse-panel-background: #fff !important;
  --jse-background-color: var(--jse-panel-background) !important;
  --jse-error-color: #ee534150 !important;
  --jse-main-border: none !important;
}

.dark, .jse-theme-dark {
  --jse-panel-background: #111 !important;
  --jse-theme-color: #111 !important;
  --jse-text-color-inverse: #fff !important;
  --jse-main-border: none !important;
}

.no-main-menu {
  border: none !important;
}

.jse-main {
  min-height: 1em !important;
}

.jse-contents {
  border-width: 0 !important;
  border-radius: 5px !important;
}

/* Scrollbar */
::-webkit-scrollbar {
  width: 6px;
}

::-webkit-scrollbar:horizontal {
  height: 6px;
}

::-webkit-scrollbar-corner {
  background: transparent;
}

::-webkit-scrollbar-track {
  background: var(--c-border);
  border-radius: 1px;
}

::-webkit-scrollbar-thumb {
  background: #8881;
  transition: background 0.2s ease;
  border-radius: 1px;
}

::-webkit-scrollbar-thumb:hover {
  background: #8885;
}

.no-scrollbar::-webkit-scrollbar {
  display: none;
  width: 0 !important;
  height: 0 !important;
}
</style>
