<script lang="ts" setup>
import 'floating-vue/dist/style.css'
import JsonEditorVue from 'json-editor-vue'
import 'vanilla-jsoneditor/themes/jse-theme-dark.css'
import { Pane, Splitpanes } from 'splitpanes'
import { joinURL, parseURL, withQuery } from 'ufo'
import { ref } from 'vue'
import { version } from '../package.json'
import type { OgImageComponent } from '../src/runtime/types'
import {
  base,
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

const emojis = ref('noto')

const debugAsyncData = fetchPathDebug()
const { data: debug, pending, error } = debugAsyncData

watch(debug, (val) => {
  if (!val)
    return
  options.value = unref(val.options)
  emojis.value = options.value.emojis
  const _options = { ...unref(val.options) }
  delete _options.path
  delete _options.socialPreview
  delete _options.cacheTtl
  delete _options.component
  delete _options.provider
  delete _options.renderer
  delete _options.componentHash
  const defaults = globalDebug.value?.runtimeConfig.defaults
  // we want to do a diff on _options and defaults and get only the differences
  Object.keys(defaults).forEach((key) => {
    if (_options[key] === defaults[key])
      delete _options[key]
  })
  optionsEditor.value = typeof _options.props !== 'undefined' ? _options.props : _options
}, {
  immediate: true,
})

const mode = useColorMode()

function updateProps(props: Record<string, any>) {
  delete props.options
  optionsOverrides.value = props
  propsEdited.value = true
  refreshSources()
}

const tab = ref('design')

function patchProps(props: Record<string, any>) {
  tab.value = 'design'
  delete props.options
  optionsOverrides.value = { ...optionsOverrides.value, ...props }
  propsEdited.value = true
  refreshSources()
}

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
  delete cloned.renderer
  delete cloned.componentHash
  optionsEditor.value = cloned
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
  return optionsOverrides.value?.extension || options.value?.extension
})
const socialPreview = ref('twitter')

const src = computed(() => {
  // wait until we know what we're rendering
  if (!debug.value)
    return ''
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
const officialComponents = computed(() => {
  return componentNames.value.filter(c => c.category === 'official')
})
const appComponents = computed(() => {
  return componentNames.value.filter(c => c.category === 'app')
})

const sidePanelOpen = ref(true)
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
    patchProps({
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
              v-for="(value, idx) of ['design', 'gallery', 'debug', 'docs']"
              :key="idx"
              class="relative n-border-base hover:n-bg-active cursor-pointer"
              :class="[
                idx ? 'border-l n-border-base ml--1px' : '',
                value === tab ? 'n-bg-active' : '',
                isPageScreenshot && value === 'gallery' ? 'hidden' : '',
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
              <div v-if="value === 'gallery'" :class="[value === tab ? '' : 'op35']">
                <VTooltip>
                  <div class="px-5 py-2">
                    <h2 text-lg flex items-center>
                      <NIcon icon="carbon:image opacity-50" />
                    </h2>
                  </div>
                  <template #popper>
                    Gallery
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
        <div class="items-center space-x-3 hidden lg:flex">
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
                    <a href="https://nuxtseo.com/og-image/getting-started/your-first-image" target="_blank" class="underline">
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
              <div class="flex justify-between items-center text-sm w-full absolute top-0 left-0">
                <div class="flex items-center text-lg space-x-1 w-[100px]">
                  <NButton icon="carbon:jpg" :border="imageFormat === 'jpeg' || imageFormat === 'jpg'" @click="patchProps({ extension: 'jpg' })" />
                  <NButton icon="carbon:png" :border="imageFormat === 'png'" @click="patchProps({ extension: 'png' })" />
                  <NButton v-if="renderer !== 'chromium'" icon="carbon:svg" :border="imageFormat === 'svg'" @click="patchProps({ extension: 'svg' })" />
                  <NButton v-if="!isPageScreenshot" icon="carbon:html" :border="imageFormat === 'html'" @click="patchProps({ extension: 'html' })" />
                </div>
                <div class="text-sm">
                  <div v-if="!isPageScreenshot" class="underline opacity-70 hover:opacity-90 transition cursor-pointer" @click="openCurrentComponent">
                    {{ activeComponentName }}.vue
                  </div>
                  <div v-else>
                    Screenshot of the current page.
                  </div>
                </div>
                <div class="flex items-center w-[100px]">
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
                  @click="openImage"
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
              <div v-if="propsEdited" class="text-xs p-2 opacity-80">
                <div>
                  To persist changes you'll need to update your component and / or props.
                  <button type="button" class="underline" @click="resetProps(true)">
                    Reset
                  </button>
                </div>
              </div>
              <OSectionBlock>
                <template #text>
                  <h3 class="opacity-80 text-base mb-1">
                    <Icon name="carbon:gui-management" class="mr-1" />
                    Render
                  </h3>
                </template>
                <div class="flex space-between">
                  <div class="flex flex-grow items-center space-x-2 text-sm">
                    <NButton v-if="!isPageScreenshot" icon="logos:vercel-icon" :border="renderer === 'satori'" @click="patchProps({ renderer: 'satori' })">
                      Satori
                    </NButton>
                    <NButton icon="logos:chrome" :border="renderer === 'chromium'" @click="patchProps({ renderer: 'chromium' })">
                      Chromium
                    </NButton>
                  </div>
                  <div class="flex items-center text-sm space-x-2">
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
                      <option value="emojione-monotone">
                        Emojione Monotone
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
              </OSectionBlock>
              <OSectionBlock>
                <template #text>
                  <h3 class="opacity-80 text-base mb-1">
                    <NIcon icon="carbon:checkmark-filled-warning" class="mr-1" />
                    Compatibility
                  </h3>
                </template>
                <div v-if="debug?.compatibility" class="text-sm">
                  <div v-if="!debug.compatibility.length" class="text-sm">
                    <NIcon icon="carbon:checkmark" class="text-green-500" /> Looks good.
                  </div>
                  <div v-for="(c, key) in debug.compatibility" v-else :key="key" class="mb-2 space-x-2 flex items-center opacity-65">
                    <NIcon icon="carbon:warning" class="text-yellow-500" />
                    <div>{{ c }}</div>
                  </div>
                </div>
              </OSectionBlock>
            </Pane>
          </Splitpanes>
        </div>
        <div v-else-if="tab === 'gallery'" class="h-full max-h-full overflow-hidden space-y-5">
          <OSectionBlock>
            <template #text>
              <h3 class="opacity-80 text-base mb-1">
                <Icon name="carbon:app" class="mr-1" />
                App
              </h3>
            </template>
            <div class="flex flex-nowrap overflow-x-auto space-x-3 p2" style="-webkit-overflow-scrolling: touch; -ms-overflow-style: -ms-autohiding-scrollbar;">
              <NLoading v-if="isLoading" />
              <button v-for="name in appComponents" v-else :key="name.pascalName" class="!p-0" @click="patchProps({ component: name.pascalName })">
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
                <Icon name="carbon:list-checked" class="mr-1" />
                Official
              </h3>
            </template>
            <div class="flex flex-nowrap overflow-x-auto space-x-3 p2" style="-webkit-overflow-scrolling: touch; -ms-overflow-style: -ms-autohiding-scrollbar;">
              <NLoading v-if="isLoading" />
              <button v-for="name in officialComponents" v-else :key="name.pascalName" class="!p-0" @click="patchProps({ component: name.pascalName })">
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
                <Icon name="carbon:airline-passenger-care" class="mr-1" />
                Community
              </h3>
            </template>
            <div class="flex flex-nowrap overflow-x-auto space-x-3 p2" style="-webkit-overflow-scrolling: touch; -ms-overflow-style: -ms-autohiding-scrollbar;">
              <NLoading v-if="isLoading" />
              <button v-for="name in communityComponents" v-else :key="name.pascalName" class="!p-0" @click="patchProps({ component: name.pascalName })">
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
        <div v-else-if="tab === 'debug'" class="h-full max-h-full overflow-hidden">
          <OSectionBlock>
            <template #text>
              <h3 class="opacity-80 text-base mb-1">
                <NIcon icon="carbon:ibm-cloud-pak-manta-automated-data-lineage" class="mr-1" />
                Path Debug
              </h3>
            </template>
            <div class="px-3 py-2 space-y-5">
              <pre of-auto h-full text-sm style="white-space: break-spaces;" v-html="highlight(JSON.stringify(debug || {}, null, 2), 'json')" />
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
