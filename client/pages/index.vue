<script lang="ts" setup>
import JsonEditorVue from 'json-editor-vue'
import { withHttps } from 'ufo'
import { useOgImage } from '../composables/og-image'
import { isConnectionFailed, isFallbackMode } from '../composables/rpc'

const {
  globalDebug,
  isCustomOgImage,
  isValidDebugError,
  aspectRatio,
  imageFormat,
  socialPreview,
  src,
  socialPreviewTitle,
  socialPreviewDescription,
  socialSiteUrl,
  slackSocialPreviewSiteName,
  activeComponentName,
  isOgImageTemplate,
  renderer,
  sidePanelOpen,
  isPageScreenshot,
  currentPageFile,
  allImageKeys,
  description,
  hasMadeChanges,
  options,
  propEditor,
  ogImageKey,
  toggleSocialPreview,
  generateLoadTime,
  openImage,
  openCurrentPageFile,
  openCurrentComponent,
  patchOptions,
  ejectComponent,
  resetProps,
  updateProps,
  refreshSources,
} = useOgImage()

const socialTabs = [
  { id: '', label: 'Raw', icon: 'carbon:image' },
  { id: 'twitter', label: 'X', icon: 'simple-icons:x' },
  { id: 'facebook', label: 'Facebook', icon: 'simple-icons:facebook' },
  { id: 'linkedin', label: 'LinkedIn', icon: 'simple-icons:linkedin' },
  { id: 'discord', label: 'Discord', icon: 'simple-icons:discord' },
  { id: 'slack', label: 'Slack', icon: 'simple-icons:slack' },
  { id: 'whatsapp', label: 'WhatsApp', icon: 'simple-icons:whatsapp' },
]
</script>

<template>
  <div class="h-full relative max-h-full bg-zinc-950">
    <!-- Demo mode when devtools connection fails -->
    <div v-if="isConnectionFailed" class="h-full flex flex-col">
      <div class="bg-amber-500/10 border-b border-amber-500/20 px-4 py-2 flex items-center gap-2 text-amber-400 text-sm">
        <NIcon icon="carbon:warning" />
        <span>Could not connect to devtools. Showing demo preview.</span>
      </div>
      <div class="flex-1 flex items-center justify-center p-8">
        <div class="w-full max-w-2xl">
          <TwitterCardRenderer title="My Page Title" :aspect-ratio="1200 / 630">
            <template #domain>
              <span>From example.com</span>
            </template>
            <div class="w-full h-full bg-linear-to-br from-emerald-500 to-sky-500 flex items-center justify-center">
              <div class="text-white text-center">
                <div class="text-4xl font-bold mb-2">
                  OG Image Preview
                </div>
                <div class="text-lg opacity-80">
                  Connect devtools to see your actual image
                </div>
              </div>
            </div>
          </TwitterCardRenderer>
          <p class="text-center text-sm opacity-50 mt-4">
            Open this page in Nuxt DevTools to preview your OG images.
          </p>
        </div>
      </div>
    </div>

    <!-- Custom OG Image (prebuilt URL) -->
    <div v-else-if="isCustomOgImage" class="h-full flex flex-col">
      <div class="px-4 py-2 border-b border-zinc-800 text-xs text-zinc-500">
        Prebuilt: {{ options?.url }}
      </div>
      <div class="flex-1 flex items-center justify-center p-8">
        <ImageLoader
          :src="src"
          :aspect-ratio="aspectRatio"
          @load="generateLoadTime"
          @refresh="refreshSources"
        />
      </div>
    </div>

    <!-- Missing defineOgImage error -->
    <div v-else-if="isValidDebugError" class="h-full flex items-center justify-center p-8">
      <div class="max-w-lg text-center">
        <div class="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-blue-500/10 mb-6">
          <NIcon icon="carbon:image-search" class="w-8 h-8 text-blue-400" />
        </div>
        <h2 class="text-xl font-semibold text-zinc-200 mb-3">
          No OG Image Defined
        </h2>
        <p class="text-zinc-400 mb-4">
          Add <code class="px-1.5 py-0.5 rounded bg-zinc-800 text-emerald-400 text-sm">defineOgImage()</code> to your
          <button class="text-blue-400 hover:underline" @click="openCurrentPageFile">
            {{ currentPageFile }}
          </button>
        </p>
        <div v-if="globalDebug?.runtimeConfig?.hasNuxtContent" class="text-sm text-zinc-500">
          Using Nuxt Content? See the <a href="https://nuxtseo.com/docs/integrations/content" target="_blank" class="text-blue-400 hover:underline">integration guide</a>
        </div>
        <a v-else href="https://nuxtseo.com/og-image/getting-started/getting-familar-with-nuxt-og-image" target="_blank" class="text-sm text-blue-400 hover:underline">
          Learn more →
        </a>
      </div>
    </div>

    <!-- Main preview UI -->
    <div v-else class="h-full flex flex-col">
      <!-- Fallback mode banner -->
      <div v-if="isFallbackMode" class="bg-sky-500/10 border-b border-sky-500/20 px-4 py-1.5 flex items-center gap-2 text-sky-400 text-xs shrink-0">
        <NIcon icon="carbon:information" />
        <span>Fallback mode: Connected to localhost:3000</span>
      </div>

      <!-- Top toolbar -->
      <div class="flex items-center justify-between px-3 py-2 border-b border-zinc-800/80 bg-zinc-900/50 shrink-0">
        <!-- Left: Renderer + Format controls -->
        <div class="flex items-center gap-3">
          <!-- Renderer badge -->
          <div
            class="flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium"
            :class="renderer === 'chromium' ? 'bg-blue-500/10 text-blue-400' : 'bg-emerald-500/10 text-emerald-400'"
          >
            <NIcon :icon="renderer === 'chromium' ? 'logos:chrome' : 'logos:vercel-icon'" class="w-3.5 h-3.5" />
            {{ renderer === 'chromium' ? 'Chromium' : 'Satori' }}
          </div>

          <!-- Format buttons -->
          <div class="flex items-center gap-0.5 p-0.5 rounded-md bg-zinc-800/50">
            <button
              v-if="!!globalDebug?.compatibility?.sharp || renderer === 'chromium' || options?.extension === 'jpeg'"
              class="px-2 py-1 rounded text-xs font-medium transition"
              :class="imageFormat === 'jpeg' || imageFormat === 'jpg' ? 'bg-zinc-700 text-zinc-100' : 'text-zinc-400 hover:text-zinc-200'"
              @click="patchOptions({ extension: 'jpg' })"
            >
              JPG
            </button>
            <button
              class="px-2 py-1 rounded text-xs font-medium transition"
              :class="imageFormat === 'png' ? 'bg-zinc-700 text-zinc-100' : 'text-zinc-400 hover:text-zinc-200'"
              @click="patchOptions({ extension: 'png' })"
            >
              PNG
            </button>
            <button
              v-if="renderer !== 'chromium'"
              class="px-2 py-1 rounded text-xs font-medium transition"
              :class="imageFormat === 'svg' ? 'bg-zinc-700 text-zinc-100' : 'text-zinc-400 hover:text-zinc-200'"
              @click="patchOptions({ extension: 'svg' })"
            >
              SVG
            </button>
            <button
              v-if="!isPageScreenshot"
              class="px-2 py-1 rounded text-xs font-medium transition"
              :class="imageFormat === 'html' ? 'bg-zinc-700 text-zinc-100' : 'text-zinc-400 hover:text-zinc-200'"
              @click="patchOptions({ extension: 'html' })"
            >
              HTML
            </button>
          </div>
        </div>

        <!-- Center: Component info -->
        <div v-if="!isPageScreenshot" class="flex items-center gap-2 text-xs text-zinc-400">
          <span class="text-zinc-300">{{ activeComponentName }}</span>
          <button
            v-if="isOgImageTemplate"
            class="text-zinc-500 hover:text-zinc-300 transition"
            @click="ejectComponent(activeComponentName)"
          >
            Eject
          </button>
          <button
            v-else
            class="text-zinc-500 hover:text-zinc-300 transition"
            @click="openCurrentComponent"
          >
            View Source
          </button>
        </div>
        <div v-else class="text-xs text-zinc-500">
          Page Screenshot
        </div>

        <!-- Right: Props toggle -->
        <button
          v-if="!isPageScreenshot"
          class="flex items-center gap-1.5 px-2 py-1 rounded-md text-xs transition"
          :class="sidePanelOpen ? 'bg-zinc-700 text-zinc-200' : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800'"
          @click="sidePanelOpen = !sidePanelOpen"
        >
          <NIcon icon="carbon:settings-adjust" class="w-3.5 h-3.5" />
          Props
        </button>
      </div>

      <!-- Social preview tabs -->
      <div class="flex items-center gap-1 px-3 py-1.5 border-b border-zinc-800/50 bg-zinc-900/30 shrink-0">
        <button
          v-for="tab in socialTabs"
          :key="tab.id"
          class="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition"
          :class="socialPreview === tab.id ? 'bg-zinc-800 text-zinc-100' : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/50'"
          @click="toggleSocialPreview(tab.id)"
        >
          <NIcon :icon="tab.icon" class="w-3.5 h-3.5" />
          {{ tab.label }}
        </button>
      </div>

      <!-- Preview area -->
      <div class="flex-1 flex items-center justify-center p-6 overflow-auto n-panel-grids-center">
        <div class="w-full max-w-2xl">
          <!-- Twitter/X preview -->
          <TwitterCardRenderer v-if="socialPreview === 'twitter'" :title="socialPreviewTitle" :aspect-ratio="aspectRatio">
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
              :max-height="300"
              :aspect-ratio="aspectRatio"
              @load="generateLoadTime"
              @refresh="refreshSources"
            />
          </TwitterCardRenderer>

          <!-- Facebook preview -->
          <FacebookCardRenderer v-else-if="socialPreview === 'facebook'">
            <template #siteName>
              {{ socialSiteUrl }}
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
          </FacebookCardRenderer>

          <!-- LinkedIn preview -->
          <LinkedInCardRenderer v-else-if="socialPreview === 'linkedin'">
            <template #siteName>
              {{ socialSiteUrl }}
            </template>
            <template #title>
              {{ socialPreviewTitle }}
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
          </LinkedInCardRenderer>

          <!-- Discord preview -->
          <DiscordCardRenderer v-else-if="socialPreview === 'discord'">
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
          </DiscordCardRenderer>

          <!-- Slack preview -->
          <SlackCardRenderer v-else-if="socialPreview === 'slack'">
            <template #favIcon>
              <img :src="`https://www.google.com/s2/favicons?domain=${encodeURIComponent(socialSiteUrl)}&sz=30`" alt="">
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
              class="h-[300px]!"
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

          <!-- WhatsApp preview -->
          <WhatsAppRenderer v-else-if="socialPreview === 'whatsapp'">
            <template #siteName>
              {{ slackSocialPreviewSiteName }}
            </template>
            <template #title>
              {{ socialPreviewTitle }}
            </template>
            <template #description>
              {{ socialPreviewDescription }}
            </template>
            <template #url>
              {{ socialSiteUrl }}
            </template>
            <img
              v-if="imageFormat !== 'html'"
              :src="src"
              alt=""
              @load="generateLoadTime({ timeTaken: '0', sizeKb: '' })"
            >
          </WhatsAppRenderer>

          <!-- Raw preview -->
          <div v-else>
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

          <!-- Status line -->
          <div v-if="description" class="mt-4 text-center text-xs text-zinc-500">
            {{ description }}
          </div>

          <!-- Multi-image key selector -->
          <div v-if="allImageKeys.length > 1" class="flex items-center justify-center gap-1 mt-3">
            <button
              v-for="key in allImageKeys"
              :key="key"
              class="px-2 py-1 rounded text-xs font-medium transition"
              :class="(ogImageKey === key || (!ogImageKey && key === 'og')) ? 'bg-zinc-700 text-zinc-200' : 'text-zinc-500 hover:text-zinc-300'"
              @click="ogImageKey = key"
            >
              {{ key }}
            </button>
          </div>
        </div>
      </div>

      <!-- Floating Props Panel -->
      <Transition
        enter-active-class="transition duration-200 ease-out"
        enter-from-class="opacity-0 translate-x-4"
        enter-to-class="opacity-100 translate-x-0"
        leave-active-class="transition duration-150 ease-in"
        leave-from-class="opacity-100 translate-x-0"
        leave-to-class="opacity-0 translate-x-4"
      >
        <div
          v-if="sidePanelOpen && !isPageScreenshot"
          class="absolute right-3 top-24 bottom-3 w-72 flex flex-col rounded-lg border border-zinc-800 bg-zinc-900/98 backdrop-blur-md shadow-2xl shadow-black/60 overflow-hidden"
        >
          <div class="flex items-center justify-between px-3 py-2 border-b border-zinc-800 bg-zinc-800/30">
            <div class="flex items-center gap-2">
              <span class="text-xs font-medium text-zinc-300">Props</span>
              <span v-if="hasMadeChanges" class="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-500/15 text-amber-400">modified</span>
            </div>
            <div class="flex items-center gap-1">
              <button
                v-if="hasMadeChanges"
                class="text-[11px] text-zinc-500 hover:text-zinc-300 transition px-1.5 py-0.5 rounded hover:bg-zinc-700/50"
                @click="resetProps(true)"
              >
                Reset
              </button>
              <button
                class="text-zinc-500 hover:text-zinc-300 transition p-1 rounded hover:bg-zinc-700/50"
                @click="sidePanelOpen = false"
              >
                <NIcon icon="carbon:close" class="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
          <div class="flex-1 overflow-auto">
            <JsonEditorVue
              :model-value="propEditor"
              class="jse-theme-dark"
              :main-menu-bar="false"
              :navigation-bar="false"
              @update:model-value="updateProps"
            />
          </div>
        </div>
      </Transition>
    </div>
  </div>
</template>
