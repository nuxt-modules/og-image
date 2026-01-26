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
  toggleSocialPreview: _toggleSocialPreview,
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
</script>

<template>
  <div class="preview-container card animate-fade-up">
    <!-- Demo mode when devtools connection fails -->
    <div v-if="isConnectionFailed" class="h-full flex flex-col">
      <div class="alert-banner warning">
        <UIcon name="carbon:warning" class="shrink-0" />
        <span>Could not connect to devtools. Showing demo preview.</span>
      </div>
      <div class="flex-1 flex items-center justify-center p-6 sm:p-8">
        <div class="w-full max-w-2xl">
          <TwitterCardRenderer title="My Page Title" :aspect-ratio="1200 / 630">
            <template #domain>
              <span>From example.com</span>
            </template>
            <div class="w-full h-full bg-gradient-to-br from-emerald-500 to-sky-500 flex items-center justify-center">
              <div class="text-white text-center p-6">
                <div class="text-2xl sm:text-4xl font-bold mb-2">
                  OG Image Preview
                </div>
                <div class="text-sm sm:text-lg opacity-80">
                  Connect devtools to see your actual image
                </div>
              </div>
            </div>
          </TwitterCardRenderer>
          <p class="text-center text-sm text-[var(--color-text-muted)] mt-4">
            Open this page in Nuxt DevTools to preview your OG images.
          </p>
        </div>
      </div>
    </div>

    <!-- Custom OG Image (prebuilt URL) -->
    <div v-else-if="isCustomOgImage" class="h-full flex flex-col">
      <div class="toolbar-minimal">
        <span class="text-[var(--color-text-subtle)]">Prebuilt:</span>
        <code class="text-[var(--color-text-muted)]">{{ options?.url }}</code>
      </div>
      <div class="flex-1 flex items-center justify-center p-6 sm:p-8">
        <ImageLoader
          :src="src"
          :aspect-ratio="aspectRatio"
          @load="generateLoadTime"
          @refresh="refreshSources"
        />
      </div>
    </div>

    <!-- Missing defineOgImage error -->
    <div v-else-if="isValidDebugError" class="h-full flex items-center justify-center p-6 sm:p-8">
      <div class="max-w-lg text-center animate-scale-in">
        <div class="empty-state-icon">
          <UIcon name="carbon:image-search" class="w-8 h-8" />
        </div>
        <h2 class="text-lg sm:text-xl font-semibold text-[var(--color-text)] mb-3">
          No OG Image Defined
        </h2>
        <p class="text-[var(--color-text-muted)] mb-4 text-sm sm:text-base">
          Add <code class="inline-code">defineOgImage()</code> to your
          <button class="text-[var(--seo-green)] hover:underline font-medium" @click="openCurrentPageFile">
            {{ currentPageFile }}
          </button>
        </p>
        <div v-if="globalDebug?.runtimeConfig?.hasNuxtContent" class="text-sm text-[var(--color-text-subtle)]">
          Using Nuxt Content? See the <a href="https://nuxtseo.com/docs/integrations/content" target="_blank" class="text-[var(--seo-green)] hover:underline">integration guide</a>
        </div>
        <a v-else href="https://nuxtseo.com/og-image/getting-started/getting-familar-with-nuxt-og-image" target="_blank" class="text-sm text-[var(--seo-green)] hover:underline inline-flex items-center gap-1">
          Learn more
          <UIcon name="carbon:arrow-right" class="w-3 h-3" />
        </a>
      </div>
    </div>

    <!-- Main preview UI -->
    <div v-else class="h-full flex flex-col">
      <!-- Fallback mode banner -->
      <div v-if="isFallbackMode" class="alert-banner info">
        <UIcon name="carbon:information" class="shrink-0" />
        <span>Fallback mode: Connected to localhost:3000</span>
      </div>

      <!-- Top toolbar -->
      <div class="toolbar">
        <!-- Left: Renderer + Format controls -->
        <div class="flex items-center gap-2 sm:gap-3 flex-wrap">
          <!-- Renderer badge -->
          <div class="renderer-badge" :class="renderer === 'chromium' ? 'chromium' : 'satori'">
            <UIcon :name="renderer === 'chromium' ? 'logos:chrome' : 'logos:vercel-icon'" class="w-3.5 h-3.5" />
            <span class="hidden sm:inline">{{ renderer === 'chromium' ? 'Chromium' : 'Satori' }}</span>
          </div>

          <!-- Format buttons -->
          <div class="format-buttons">
            <button
              v-if="!!globalDebug?.compatibility?.sharp || renderer === 'chromium' || options?.extension === 'jpeg'"
              class="format-btn"
              :class="{ active: imageFormat === 'jpeg' || imageFormat === 'jpg' }"
              @click="patchOptions({ extension: 'jpg' })"
            >
              JPG
            </button>
            <button
              class="format-btn"
              :class="{ active: imageFormat === 'png' }"
              @click="patchOptions({ extension: 'png' })"
            >
              PNG
            </button>
            <button
              v-if="renderer !== 'chromium'"
              class="format-btn"
              :class="{ active: imageFormat === 'svg' }"
              @click="patchOptions({ extension: 'svg' })"
            >
              SVG
            </button>
            <button
              v-if="!isPageScreenshot"
              class="format-btn"
              :class="{ active: imageFormat === 'html' }"
              @click="patchOptions({ extension: 'html' })"
            >
              HTML
            </button>
          </div>
        </div>

        <!-- Center: Component info -->
        <div v-if="!isPageScreenshot" class="component-info hidden md:flex">
          <span class="font-medium text-[var(--color-text)]">{{ activeComponentName }}</span>
          <button
            v-if="isOgImageTemplate"
            class="component-action"
            @click="ejectComponent(activeComponentName)"
          >
            Eject
          </button>
          <button
            v-else
            class="component-action"
            @click="openCurrentComponent"
          >
            View Source
          </button>
        </div>
        <div v-else class="component-info hidden md:flex">
          <span class="text-[var(--color-text-subtle)]">Page Screenshot</span>
        </div>

        <!-- Right: Props toggle -->
        <UButton
          v-if="!isPageScreenshot"
          :variant="sidePanelOpen ? 'soft' : 'ghost'"
          :color="sidePanelOpen ? 'primary' : 'neutral'"
          size="xs"
          icon="carbon:settings-adjust"
          class="props-toggle"
          @click="sidePanelOpen = !sidePanelOpen"
        >
          <span class="hidden sm:inline">Props</span>
        </UButton>
      </div>

      <!-- Social preview tabs -->
      <div class="social-tabs">
        <div class="social-buttons">
          <button
            class="social-btn"
            :class="{ active: socialPreview === '' }"
            @click="socialPreview = ''"
          >
            <UIcon name="carbon:image" class="w-3.5 h-3.5" />
            Raw
          </button>
          <button
            class="social-btn"
            :class="{ active: socialPreview === 'twitter' }"
            @click="socialPreview = 'twitter'"
          >
            <UIcon name="simple-icons:x" class="w-3.5 h-3.5" />
            X
          </button>
          <button
            class="social-btn"
            :class="{ active: socialPreview === 'facebook' }"
            @click="socialPreview = 'facebook'"
          >
            <UIcon name="simple-icons:facebook" class="w-3.5 h-3.5" />
            Facebook
          </button>
          <button
            class="social-btn"
            :class="{ active: socialPreview === 'linkedin' }"
            @click="socialPreview = 'linkedin'"
          >
            <UIcon name="simple-icons:linkedin" class="w-3.5 h-3.5" />
            LinkedIn
          </button>
          <button
            class="social-btn"
            :class="{ active: socialPreview === 'discord' }"
            @click="socialPreview = 'discord'"
          >
            <UIcon name="simple-icons:discord" class="w-3.5 h-3.5" />
            Discord
          </button>
          <button
            class="social-btn"
            :class="{ active: socialPreview === 'slack' }"
            @click="socialPreview = 'slack'"
          >
            <UIcon name="simple-icons:slack" class="w-3.5 h-3.5" />
            Slack
          </button>
          <button
            class="social-btn"
            :class="{ active: socialPreview === 'whatsapp' }"
            @click="socialPreview = 'whatsapp'"
          >
            <UIcon name="simple-icons:whatsapp" class="w-3.5 h-3.5" />
            WhatsApp
          </button>
        </div>
      </div>

      <!-- Preview area -->
      <div class="preview-area panel-grids">
        <div class="preview-content">
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
          <div v-else class="raw-preview">
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
          <div v-if="description" class="status-line">
            {{ description }}
          </div>

          <!-- Multi-image key selector -->
          <div v-if="allImageKeys.length > 1" class="image-key-selector">
            <button
              v-for="key in allImageKeys"
              :key="key"
              class="key-btn"
              :class="{ active: ogImageKey === key || (!ogImageKey && key === 'og') }"
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
        <div v-if="sidePanelOpen && !isPageScreenshot" class="props-panel">
          <div class="props-header">
            <div class="flex items-center gap-2">
              <span class="text-sm font-medium text-[var(--color-text)]">Props</span>
              <UBadge v-if="hasMadeChanges" color="warning" variant="subtle" size="xs">
                modified
              </UBadge>
            </div>
            <div class="flex items-center gap-1">
              <UButton
                v-if="hasMadeChanges"
                variant="ghost"
                color="neutral"
                size="xs"
                @click="resetProps(true)"
              >
                Reset
              </UButton>
              <UButton
                variant="ghost"
                color="neutral"
                size="xs"
                icon="carbon:close"
                @click="sidePanelOpen = false"
              />
            </div>
          </div>
          <div class="props-content">
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

<style scoped>
.preview-container {
  height: calc(100vh - 100px);
  min-height: 500px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

/* Alert banners */
.alert-banner {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 1rem;
  font-size: 0.8125rem;
  border-bottom: 1px solid var(--color-border);
}

.alert-banner.warning {
  background: oklch(85% 0.12 85 / 0.1);
  color: oklch(55% 0.15 85);
  border-bottom-color: oklch(75% 0.12 85 / 0.2);
}

.dark .alert-banner.warning {
  background: oklch(45% 0.12 85 / 0.15);
  color: oklch(80% 0.12 85);
}

.alert-banner.info {
  background: oklch(85% 0.1 230 / 0.1);
  color: oklch(55% 0.12 230);
  border-bottom-color: oklch(75% 0.1 230 / 0.2);
}

.dark .alert-banner.info {
  background: oklch(45% 0.1 230 / 0.15);
  color: oklch(80% 0.1 230);
}

/* Toolbar */
.toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  padding: 0.625rem 0.75rem;
  border-bottom: 1px solid var(--color-border);
  background: var(--color-surface-elevated);
}

@media (min-width: 640px) {
  .toolbar {
    padding: 0.75rem 1rem;
  }
}

.toolbar-minimal {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 1rem;
  font-size: 0.75rem;
  border-bottom: 1px solid var(--color-border);
  background: var(--color-surface-sunken);
}

/* Renderer badge */
.renderer-badge {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.25rem 0.5rem;
  border-radius: var(--radius-sm);
  font-size: 0.75rem;
  font-weight: 500;
}

.renderer-badge.chromium {
  background: oklch(85% 0.1 230 / 0.15);
  color: oklch(55% 0.12 230);
}

.dark .renderer-badge.chromium {
  background: oklch(45% 0.1 230 / 0.2);
  color: oklch(75% 0.1 230);
}

.renderer-badge.satori {
  background: oklch(85% 0.12 145 / 0.15);
  color: oklch(55% 0.15 145);
}

.dark .renderer-badge.satori {
  background: oklch(40% 0.12 145 / 0.2);
  color: oklch(75% 0.15 145);
}

/* Format buttons */
.format-buttons {
  display: flex;
  align-items: center;
  gap: 0.125rem;
  padding: 0.125rem;
  border-radius: var(--radius-sm);
  background: var(--color-surface-sunken);
  border: 1px solid var(--color-border-subtle);
}

.format-btn {
  padding: 0.25rem 0.5rem;
  border-radius: calc(var(--radius-sm) - 2px);
  font-size: 0.6875rem;
  font-weight: 600;
  color: var(--color-text-muted);
  transition: all 150ms ease;
  text-transform: uppercase;
  letter-spacing: 0.02em;
}

@media (min-width: 640px) {
  .format-btn {
    padding: 0.25rem 0.625rem;
    font-size: 0.75rem;
  }
}

.format-btn:hover {
  color: var(--color-text);
}

.format-btn.active {
  background: var(--color-surface-elevated);
  color: var(--color-text);
  box-shadow: 0 1px 2px oklch(0% 0 0 / 0.06);
}

.dark .format-btn.active {
  box-shadow: 0 1px 2px oklch(0% 0 0 / 0.2);
}

/* Component info */
.component-info {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.8125rem;
}

.component-action {
  color: var(--color-text-subtle);
  font-size: 0.75rem;
  transition: color 150ms ease;
}

.component-action:hover {
  color: var(--seo-green);
}

/* Social tabs */
.social-tabs {
  padding: 0.5rem 0.75rem;
  border-bottom: 1px solid var(--color-border);
  background: var(--color-surface-elevated);
}

@media (min-width: 640px) {
  .social-tabs {
    padding: 0.5rem 1rem;
  }
}

.social-buttons {
  display: flex;
  align-items: center;
  gap: 0.125rem;
  padding: 0.125rem;
  border-radius: var(--radius-sm);
  background: var(--color-surface-sunken);
  border: 1px solid var(--color-border-subtle);
}

.social-btn {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.25rem 0.5rem;
  border-radius: calc(var(--radius-sm) - 2px);
  font-size: 0.75rem;
  font-weight: 500;
  color: var(--color-text-muted);
  transition: all 150ms ease;
}

@media (min-width: 640px) {
  .social-btn {
    padding: 0.25rem 0.625rem;
  }
}

.social-btn:hover {
  color: var(--color-text);
}

.social-btn.active {
  background: var(--color-surface-elevated);
  color: var(--color-text);
  box-shadow: 0 1px 2px oklch(0% 0 0 / 0.06);
}

.dark .social-btn.active {
  box-shadow: 0 1px 2px oklch(0% 0 0 / 0.2);
}

/* Preview area */
.preview-area {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1rem;
  overflow: auto;
  position: relative;
}

@media (min-width: 640px) {
  .preview-area {
    padding: 1.5rem;
  }
}

.preview-content {
  width: 100%;
  max-width: 42rem;
  margin: 0 auto;
}

.raw-preview {
  width: 100%;
  border-radius: var(--radius-lg);
  overflow: hidden;
  box-shadow: 0 4px 24px oklch(0% 0 0 / 0.08);
}

.dark .raw-preview {
  box-shadow: 0 4px 24px oklch(0% 0 0 / 0.3);
}

/* Status line */
.status-line {
  margin-top: 1rem;
  text-align: center;
  font-size: 0.75rem;
  color: var(--color-text-subtle);
}

/* Image key selector */
.image-key-selector {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.25rem;
  margin-top: 0.75rem;
}

.key-btn {
  padding: 0.25rem 0.625rem;
  border-radius: var(--radius-sm);
  font-size: 0.75rem;
  font-weight: 500;
  color: var(--color-text-muted);
  transition: all 150ms ease;
}

.key-btn:hover {
  color: var(--color-text);
}

.key-btn.active {
  background: var(--color-surface-elevated);
  color: var(--color-text);
  box-shadow: 0 1px 3px oklch(0% 0 0 / 0.08);
}

.dark .key-btn.active {
  box-shadow: 0 1px 3px oklch(0% 0 0 / 0.25);
}

/* Props panel */
.props-panel {
  position: absolute;
  right: 0.75rem;
  top: 7rem;
  bottom: 0.75rem;
  width: 18rem;
  display: flex;
  flex-direction: column;
  border-radius: var(--radius-lg);
  border: 1px solid var(--color-border);
  background: var(--color-surface-elevated);
  box-shadow: 0 8px 32px oklch(0% 0 0 / 0.12);
  overflow: hidden;
}

.dark .props-panel {
  box-shadow: 0 8px 32px oklch(0% 0 0 / 0.4);
}

@media (min-width: 640px) {
  .props-panel {
    right: 1rem;
    top: 8rem;
    bottom: 1rem;
  }
}

.props-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.625rem 0.75rem;
  border-bottom: 1px solid var(--color-border);
  background: var(--color-surface-sunken);
}

.props-content {
  flex: 1;
  overflow: auto;
}

/* Empty state */
.empty-state-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 4rem;
  height: 4rem;
  border-radius: var(--radius-lg);
  background: oklch(85% 0.1 230 / 0.15);
  color: oklch(55% 0.12 230);
  margin-bottom: 1.5rem;
}

.dark .empty-state-icon {
  background: oklch(45% 0.1 230 / 0.2);
  color: oklch(75% 0.1 230);
}

/* Inline code */
.inline-code {
  padding: 0.125rem 0.375rem;
  border-radius: var(--radius-sm);
  background: var(--color-surface-sunken);
  border: 1px solid var(--color-border-subtle);
  font-family: var(--font-mono);
  font-size: 0.8125rem;
  color: var(--seo-green);
}
</style>
