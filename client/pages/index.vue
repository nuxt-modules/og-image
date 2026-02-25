<script lang="ts" setup>
import JsonEditorVue from 'json-editor-vue'
import { useHead } from 'nuxt/app'
import { withHttps } from 'ufo'
import { computed, reactive, ref, watch } from 'vue'
import { useOgImage } from '../composables/og-image'
import { RendererSelectDialogPromise } from '../composables/renderer-select'
import { isConnectionFailed, isFallbackMode } from '../composables/rpc'

const {
  globalDebug,
  isDebugLoading,
  isCustomOgImage,
  isValidDebugError,
  hasDefinedOgImage,
  fetchError,
  aspectRatio,
  imageFormat,
  socialPreview,
  imageColorMode,
  src,
  socialPreviewTitle,
  socialPreviewDescription,
  socialSiteUrl,
  slackSocialPreviewSiteName,
  activeComponentName,
  activeComponent,
  activeComponentRelativePath,
  isOgImageTemplate,
  renderer,
  isComponentCompatibleWithRenderer,
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
  ejectComponent,
  resetProps,
  updateProps,
  refreshSources,
} = useOgImage()

const rendererIcons: Record<string, string> = {
  satori: 'logos:vercel-icon',
  browser: 'logos:chrome',
}

const activeFormatLabel = computed(() => {
  const ext = imageFormat.value === 'jpeg' ? 'JPG' : imageFormat.value?.toUpperCase() || 'PNG'
  const name = renderer.value === 'browser' ? 'Browser' : renderer.value === 'takumi' ? 'Takumi' : 'Satori'
  return `${name} - ${ext}`
})

const socialItems = [
  { label: 'Raw', icon: 'carbon:image', value: '' },
  // Optical size adjustments: thin logos scale up, dense filled shapes scale down
  { label: 'Twitter / X', icon: 'simple-icons:x', value: 'twitter', iconScale: 0.8 },
  { label: 'Facebook', icon: 'simple-icons:facebook', value: 'facebook', iconScale: 0.92 },
  { label: 'LinkedIn', icon: 'simple-icons:linkedin', value: 'linkedin', iconScale: 0.92 },
  { label: 'Discord', icon: 'simple-icons:discord', value: 'discord', iconScale: 0.95 },
  { label: 'Slack', icon: 'simple-icons:slack', value: 'slack' },
  { label: 'WhatsApp', icon: 'simple-icons:whatsapp', value: 'whatsapp', iconScale: 0.92 },
  { label: 'Bluesky', icon: 'simple-icons:bluesky', value: 'bluesky', iconScale: 0.92 },
]

const protoTab = ref('meta-tags')
const protoTabs = computed(() => {
  const tabs = [
    { label: 'Meta Tags', value: 'meta-tags' },
    { label: 'OG Image Props', value: 'og-props' },
    { label: 'Fonts', value: 'fonts' },
  ]
  if (!socialPreview.value)
    return tabs.filter(t => t.value !== 'meta-tags')
  return tabs
})

watch(socialPreview, (val) => {
  if (!val && protoTab.value === 'meta-tags')
    protoTab.value = 'og-props'
})

const isTwitterMode = computed(() => socialPreview.value === 'twitter')
const metaLabelPrefix = computed(() => isTwitterMode.value ? 'Twitter' : 'OG')

interface FontFileEntry {
  key: string
  family: string
  weight: number
  style: string
  src: string
  label: string
  loaded: boolean
  subsetCount: number
  subsets: string[]
}

const fontFiles = computed<FontFileEntry[]>(() => {
  const available = globalDebug.value?.availableFonts || []
  const resolved = globalDebug.value?.resolvedFonts || []
  if (!available.length && !resolved.length)
    return []
  const source = available.length ? available : resolved
  // Build set of resolved keys for loaded check
  const resolvedKeys = new Set(resolved.map((f: any) => `${f.family}-${f.weight}-${f.style}`))
  // Count subsets per family+weight+style and collect subset names
  const subsetMap = new Map<string, string[]>()
  for (const f of source) {
    const key = `${f.family}-${f.weight}-${f.style}`
    const subs = subsetMap.get(key) || []
    if (f.subset)
      subs.push(f.subset)
    subsetMap.set(key, subs)
  }
  // Dedupe by family+weight+style (multiple unicode-range subsets)
  const seen = new Set<string>()
  const entries: FontFileEntry[] = []
  for (const f of source) {
    const key = `${f.family}-${f.weight}-${f.style}`
    if (seen.has(key))
      continue
    seen.add(key)
    const subs = subsetMap.get(key) || []
    entries.push({
      key,
      family: f.family,
      weight: f.weight,
      style: f.style,
      src: f.src,
      label: `${f.family} ${f.weight}${f.style === 'italic' ? 'i' : ''}`,
      loaded: resolvedKeys.has(key),
      subsetCount: Math.max(subs.length, 1),
      subsets: subs,
    })
  }
  // Sort: by family, then weight, then style
  entries.sort((a, b) => a.family.localeCompare(b.family) || a.weight - b.weight || a.style.localeCompare(b.style))
  return entries
})

/** Total byte size of all resolved font files per family */
const fontFamilySizes = computed(() => {
  const resolved = globalDebug.value?.resolvedFonts || []
  const sizes = new Map<string, number>()
  for (const f of resolved) {
    if (f.size)
      sizes.set(f.family, (sizes.get(f.family) || 0) + f.size)
  }
  return sizes
})

function formatBytes(bytes: number): string {
  if (bytes < 1024)
    return `${bytes} B`
  const kb = bytes / 1024
  return kb < 1000 ? `${kb.toFixed(1)} kB` : `${(kb / 1024).toFixed(1)} MB`
}

const fontFamilyNames = computed(() => [...new Set(fontFiles.value.map(f => f.family))])
const resolvedFamilyNames = computed(() => [...new Set(fontFiles.value.filter(f => f.loaded).map(f => f.family))])

const detectedFontRequirements = computed(() => globalDebug.value?.fontRequirements)

const unresolvedFamilies = computed(() => {
  const detected = detectedFontRequirements.value?.families
  if (!detected?.length)
    return []
  const available = new Set(fontFamilyNames.value)
  return detected.filter((f: string) => !available.has(f))
})

const fontFaceCss = computed(() => {
  const rules: string[] = []
  const seen = new Set<string>()
  for (const f of fontFiles.value) {
    if (seen.has(f.family))
      continue
    seen.add(f.family)
    rules.push(`@font-face { font-family: 'ogp-${f.family}'; src: url('${f.src}'); font-display: swap; }`)
  }
  return rules.join('\n')
})

useHead({ style: computed(() => fontFaceCss.value ? [fontFaceCss.value] : []) })

const fontOverride = ref('')

function applyFontOverride(family: string) {
  const next = fontOverride.value === family ? '' : family
  fontOverride.value = next
  hasMadeChanges.value = true
  updateProps({ fontFamily: next || undefined })
}

const metaOverrides = reactive({
  ogTitle: '',
  twitterTitle: '',
  siteName: '',
  description: '',
})

const effectiveTitle = computed(() => {
  if (socialPreview.value === 'twitter' && metaOverrides.twitterTitle)
    return metaOverrides.twitterTitle
  return metaOverrides.ogTitle || socialPreviewTitle.value
})

const effectiveDescription = computed(() => {
  return metaOverrides.description || socialPreviewDescription.value
})

const effectiveSiteName = computed(() => {
  return metaOverrides.siteName || slackSocialPreviewSiteName.value
})

const effectiveSiteUrl = computed(() => {
  return metaOverrides.siteName || socialSiteUrl.value
})

function updateMetaField(field: keyof typeof metaOverrides, value: string) {
  metaOverrides[field] = value
  hasMadeChanges.value = true
}

const hasMetaOverrides = computed(() => Object.values(metaOverrides).some(Boolean))

const seoMetaSnippet = computed(() => {
  const entries: string[] = []
  if (metaOverrides.ogTitle)
    entries.push(`  ogTitle: '${metaOverrides.ogTitle.replace(/'/g, '\\\'')}'`)
  if (metaOverrides.description)
    entries.push(`  ogDescription: '${metaOverrides.description.replace(/'/g, '\\\'')}'`)
  if (metaOverrides.siteName)
    entries.push(`  ogSiteName: '${metaOverrides.siteName.replace(/'/g, '\\\'')}'`)
  if (metaOverrides.twitterTitle)
    entries.push(`  twitterTitle: '${metaOverrides.twitterTitle.replace(/'/g, '\\\'')}'`)
  if (!entries.length)
    return ''
  return `useSeoMeta({\n${entries.join(',\n')}\n})`
})

const snippetCopied = ref(false)

function copySnippet() {
  if (!seoMetaSnippet.value)
    return
  navigator.clipboard.writeText(seoMetaSnippet.value)
  snippetCopied.value = true
  setTimeout(() => snippetCopied.value = false, 2000)
}

function resetAll() {
  resetProps(true)
  fontOverride.value = ''
  Object.assign(metaOverrides, { ogTitle: '', twitterTitle: '', siteName: '', description: '' })
}
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

    <!-- Loading state -->
    <div v-else-if="isDebugLoading" class="h-full flex items-center justify-center p-6 sm:p-8">
      <div class="max-w-lg text-center">
        <div class="empty-state-icon animate-pulse">
          <UIcon name="carbon:image-search" class="w-8 h-8" />
        </div>
        <h2 class="text-lg sm:text-xl font-semibold text-[var(--color-text)] mb-3">
          Loading OG Image&#8230;
        </h2>
      </div>
    </div>

    <!-- Server error (e.g. font loading failure) -->
    <div v-else-if="fetchError" class="h-full flex items-center justify-center p-6 sm:p-8">
      <div class="max-w-lg text-center animate-scale-in">
        <div class="empty-state-icon empty-state-icon--error">
          <UIcon name="carbon:warning" class="w-8 h-8" />
        </div>
        <h2 class="text-lg sm:text-xl font-semibold text-[var(--color-text)] mb-3">
          OG Image Error
        </h2>
        <p class="text-[var(--color-text-muted)] mb-4 text-sm sm:text-base">
          {{ fetchError.message }}
        </p>
        <details v-if="fetchError.stack?.length" class="text-left">
          <summary class="text-xs text-[var(--color-text-subtle)] cursor-pointer hover:text-[var(--color-text-muted)]">
            Stack trace
          </summary>
          <pre class="mt-2 text-xs text-[var(--color-text-subtle)] overflow-auto max-h-48 p-3 rounded-lg bg-[var(--color-surface-sunken)] border border-[var(--color-border-subtle)]">{{ fetchError.stack.join('\n') }}</pre>
        </details>
      </div>
    </div>

    <!-- Missing defineOgImage error -->
    <div v-else-if="isValidDebugError || !hasDefinedOgImage" class="h-full flex items-center justify-center p-6 sm:p-8">
      <div class="max-w-lg text-center animate-scale-in">
        <div class="empty-state-icon">
          <UIcon name="carbon:image-search" class="w-8 h-8" />
        </div>
        <h2 class="text-lg sm:text-xl font-semibold text-[var(--color-text)] mb-3">
          No OG Image Defined
        </h2>
        <p class="text-[var(--color-text-muted)] mb-4 text-sm sm:text-base">
          Add <code class="inline-code">defineOgImage()</code> to your
          <UButton variant="link" class="cursor-pointer" @click="openCurrentPageFile">
            {{ currentPageFile }}
          </UButton>
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

      <!-- Renderer incompatibility banner -->
      <div v-if="!isComponentCompatibleWithRenderer && activeComponent" class="alert-banner warning">
        <UIcon name="carbon:warning" class="shrink-0" />
        <span>
          Component <code class="inline-code">{{ activeComponentName }}</code> uses {{ activeComponent.renderer }} renderer.
          <NuxtLink to="/templates" class="text-[var(--seo-green)] hover:underline ml-1">Select a {{ renderer }} template</NuxtLink>
        </span>
      </div>

      <!-- Top toolbar -->
      <div class="toolbar">
        <!-- Left: Renderer + Format controls -->
        <div class="flex items-center gap-2 sm:gap-3 flex-wrap">
          <UButton color="neutral" variant="ghost" size="xs" aria-label="Change renderer and format" @click="RendererSelectDialogPromise.start()">
            <img v-if="renderer === 'takumi'" src="https://takumi.kane.tw/logo.svg" class="w-3.5 h-3.5" width="14" height="14" alt="">
            <UIcon v-else :name="rendererIcons[renderer] || 'logos:vercel-icon'" class="w-3.5 h-3.5" />
            <span class="hidden sm:inline">{{ activeFormatLabel }}</span>
            <UIcon name="carbon:chevron-down" class="w-3 h-3 opacity-60" />
          </UButton>
        </div>

        <!-- Center: Component info -->
        <div v-if="!isPageScreenshot" class="component-info hidden md:flex">
          <UButton
            variant="link"
            class="component-path-link cursor-pointer"
            :disabled="isOgImageTemplate"
            @click="openCurrentComponent"
          >
            <span v-if="activeComponentRelativePath"><span class="text-[var(--color-text-muted)] hidden min-[850px]:inline">{{ activeComponentRelativePath.replace(/[^/]+\.vue$/, '') }}</span><span class="text-[var(--color-text)]">{{ activeComponentRelativePath.match(/[^/]+\.vue$/)?.[0] || activeComponentName }}</span></span>
            <span v-else class="text-[var(--color-text)]">{{ activeComponentName }}</span>
          </UButton>
          <UButton
            v-if="isOgImageTemplate"
            variant="link"
            size="xs"
            class="cursor-pointer text-[var(--color-text-subtle)]"
            @click="ejectComponent(activeComponentName)"
          >
            Eject
          </UButton>
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
          <span class="hidden sm:inline">Debug</span>
        </UButton>
      </div>

      <!-- Social preview tabs -->
      <div class="px-3 sm:px-4 border-b border-[var(--color-border)] bg-[var(--color-surface-elevated)]">
        <UTabs
          v-model="socialPreview"
          :items="socialItems"
          :content="false"
          size="xs"
          variant="link"
          color="neutral"
        >
          <template #leading="{ item, ui }">
            <UIcon
              :name="item.icon"
              :class="ui.leadingIcon"
              :style="item.iconScale ? { transform: `scale(${item.iconScale})` } : undefined"
            />
          </template>
        </UTabs>
      </div>

      <!-- Preview area -->
      <div class="preview-area panel-grids" :class="{ 'preview-area--panel-open': sidePanelOpen && !isPageScreenshot }">
        <div class="preview-content">
          <!-- Twitter/X preview -->
          <TwitterCardRenderer v-if="socialPreview === 'twitter'" :title="effectiveTitle" :aspect-ratio="aspectRatio">
            <template #domain>
              <a target="_blank" :href="withHttps(socialSiteUrl)">From {{ effectiveSiteUrl }}</a>
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
              {{ effectiveSiteUrl }}
            </template>
            <template #title>
              {{ effectiveTitle }}
            </template>
            <template #description>
              {{ effectiveDescription }}
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
              {{ effectiveSiteUrl }}
            </template>
            <template #title>
              {{ effectiveTitle }}
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
              {{ effectiveSiteName }}
            </template>
            <template #title>
              {{ effectiveTitle }}
            </template>
            <template #description>
              {{ effectiveDescription }}
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
              <img :src="`https://www.google.com/s2/favicons?domain=${encodeURIComponent(socialSiteUrl)}&sz=30`" width="30" height="30" alt="">
            </template>
            <template #siteName>
              {{ effectiveSiteName }}
            </template>
            <template #title>
              {{ effectiveTitle }}
            </template>
            <template #description>
              {{ effectiveDescription }}
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

          <!-- WhatsApp preview -->
          <WhatsAppRenderer v-else-if="socialPreview === 'whatsapp'">
            <template #siteName>
              {{ effectiveSiteName }}
            </template>
            <template #title>
              {{ effectiveTitle }}
            </template>
            <template #description>
              {{ effectiveDescription }}
            </template>
            <template #url>
              {{ effectiveSiteUrl }}
            </template>
            <img
              v-if="imageFormat !== 'html'"
              :src="src"
              alt=""
              @load="generateLoadTime({ timeTaken: '0', sizeKb: '' })"
            >
          </WhatsAppRenderer>

          <!-- Bluesky preview -->
          <BlueskyCardRenderer v-else-if="socialPreview === 'bluesky'">
            <template #siteName>
              {{ effectiveSiteUrl }}
            </template>
            <template #title>
              {{ effectiveTitle }}
            </template>
            <template #description>
              {{ effectiveDescription }}
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
          </BlueskyCardRenderer>

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
          <UTabs
            v-if="allImageKeys.length > 1"
            :items="allImageKeys.map((key: string) => ({ label: key, value: key }))"
            :model-value="ogImageKey || 'og'"
            :content="false"
            size="xs"
            variant="pill"
            color="neutral"
            class="mt-3 justify-center"
            @update:model-value="ogImageKey = $event as string"
          />
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
              <span class="text-sm font-medium text-[var(--color-text)]">Debug</span>
            </div>
            <div class="flex items-center gap-1">
              <UButton
                v-if="hasMadeChanges"
                variant="ghost"
                color="neutral"
                size="xs"
                @click="resetAll()"
              >
                Reset
              </UButton>
              <UButton
                variant="ghost"
                color="neutral"
                size="xs"
                icon="carbon:close"
                aria-label="Close panel"
                @click="sidePanelOpen = false"
              />
            </div>
          </div>
          <div class="props-content">
            <div class="px-3 pt-2 border-b border-[var(--color-border)]">
              <UTabs
                v-model="protoTab"
                :items="protoTabs"
                :content="false"
                size="xs"
                variant="link"
                color="neutral"
              />
            </div>

            <!-- Meta Tags Tab -->
            <div v-if="protoTab === 'meta-tags'">
              <div class="props-field">
                <div class="props-field-label">
                  <span>{{ metaLabelPrefix }} Title</span>
                  <UTooltip :text="isTwitterMode ? 'The twitter:title meta tag. Controls the title shown on Twitter/X cards.' : 'The og:title meta tag. Controls the title shown when shared on social platforms.'" :delay-duration="0">
                    <UIcon name="carbon:help" class="w-3.5 h-3.5 text-[var(--color-text-subtle)] cursor-help" />
                  </UTooltip>
                </div>
                <UInput
                  :model-value="isTwitterMode ? (metaOverrides.twitterTitle || socialPreviewTitle) : (metaOverrides.ogTitle || socialPreviewTitle)"
                  size="xs"
                  :name="isTwitterMode ? 'twitter-title' : 'og-title'"
                  autocomplete="off"
                  :placeholder="isTwitterMode ? 'twitter:title…' : 'og:title…'"
                  @update:model-value="updateMetaField(isTwitterMode ? 'twitterTitle' : 'ogTitle', $event as string)"
                />
              </div>

              <div class="props-field">
                <div class="props-field-label">
                  <span>{{ metaLabelPrefix }} Description</span>
                  <UTooltip :text="isTwitterMode ? 'The twitter:description meta tag. Controls the description shown on Twitter/X cards.' : 'The og:description meta tag. Controls the description shown when shared on social platforms.'" :delay-duration="0">
                    <UIcon name="carbon:help" class="w-3.5 h-3.5 text-[var(--color-text-subtle)] cursor-help" />
                  </UTooltip>
                </div>
                <UInput
                  :model-value="metaOverrides.description || socialPreviewDescription"
                  size="xs"
                  :name="isTwitterMode ? 'twitter-description' : 'og-description'"
                  autocomplete="off"
                  :placeholder="isTwitterMode ? 'twitter:description…' : 'og:description…'"
                  @update:model-value="updateMetaField('description', $event as string)"
                />
              </div>

              <div class="props-field">
                <div class="props-field-label">
                  <span>{{ socialPreview === 'discord' ? 'OG Site Name' : 'OG URL' }}</span>
                  <UTooltip :text="socialPreview === 'discord' ? 'The og:site_name meta tag. Discord uses this for the provider name above the title.' : 'The og:url meta tag. The canonical URL shown in social card previews.'" :delay-duration="0">
                    <UIcon name="carbon:help" class="w-3.5 h-3.5 text-[var(--color-text-subtle)] cursor-help" />
                  </UTooltip>
                </div>
                <UInput
                  :model-value="metaOverrides.siteName || slackSocialPreviewSiteName"
                  size="xs"
                  :name="socialPreview === 'discord' ? 'og-site-name' : 'og-url'"
                  autocomplete="off"
                  :placeholder="socialPreview === 'discord' ? 'og:site_name…' : 'og:url…'"
                  @update:model-value="updateMetaField('siteName', $event as string)"
                />
              </div>
            </div>

            <!-- OG Image Props Tab -->
            <div v-else-if="protoTab === 'og-props'">
              <div class="props-field">
                <div class="props-field-label">
                  <span>Color Mode</span>
                  <UTooltip text="Changes the color mode passed to the OG image renderer." :delay-duration="0">
                    <UIcon name="carbon:help" class="w-3.5 h-3.5 text-[var(--color-text-subtle)] cursor-help" />
                  </UTooltip>
                </div>
                <UButton
                  size="xs"
                  color="neutral"
                  variant="soft"
                  :icon="imageColorMode === 'dark' ? 'carbon:moon' : 'carbon:sun'"
                  @click="imageColorMode = imageColorMode === 'dark' ? 'light' : 'dark'"
                >
                  {{ imageColorMode === 'dark' ? 'Dark' : 'Light' }}
                </UButton>
              </div>

              <JsonEditorVue
                :model-value="propEditor"
                class="jse-theme-dark"
                :main-menu-bar="false"
                :navigation-bar="false"
                @update:model-value="updateProps"
              />
            </div>

            <!-- Fonts Tab -->
            <div v-else-if="protoTab === 'fonts'" class="fonts-tab">
              <!-- Detected requirements — compact summary bar -->
              <div v-if="detectedFontRequirements" class="fonts-detected">
                <div class="fonts-detected-inner">
                  <span class="fonts-detected-label">Detected</span>
                  <span v-for="w in detectedFontRequirements.weights" :key="`w-${w}`" class="fonts-chip">{{ w }}</span>
                  <span v-for="s in detectedFontRequirements.styles" :key="`s-${s}`" class="fonts-chip">{{ s }}</span>
                  <template v-if="detectedFontRequirements.families?.length">
                    <span class="fonts-detected-sep" />
                    <span
                      v-for="f in detectedFontRequirements.families"
                      :key="f"
                      class="fonts-chip"
                      :class="unresolvedFamilies.includes(f) ? 'fonts-chip--error' : 'fonts-chip--family'"
                    >
                      <UIcon v-if="unresolvedFamilies.includes(f)" name="carbon:warning-filled" class="w-2.5 h-2.5 shrink-0" />
                      {{ f }}
                    </span>
                  </template>
                </div>
              </div>

              <!-- Resolved fonts actually used for rendering -->
              <div v-if="resolvedFamilyNames.length" class="fonts-detected fonts-resolved">
                <div class="fonts-detected-inner">
                  <span class="fonts-detected-label">Rendering</span>
                  <span v-for="f in resolvedFamilyNames" :key="f" class="fonts-chip fonts-chip--family">{{ f }}</span>
                </div>
              </div>

              <!-- Font specimen list -->
              <div v-if="fontFiles.length" class="fonts-specimen">
                <template v-for="family in fontFamilyNames" :key="family">
                  <button
                    class="fonts-family-row"
                    :class="{ active: fontOverride === family }"
                    @click="applyFontOverride(family)"
                  >
                    <span class="fonts-family-name" :style="{ fontFamily: `'ogp-${family}', sans-serif` }">{{ family }}</span>
                    <span class="fonts-family-meta">
                      <span v-if="fontFamilySizes.get(family)" class="fonts-family-size">{{ formatBytes(fontFamilySizes.get(family)!) }}</span>
                      <UIcon v-if="fontOverride === family" name="carbon:checkmark-filled" class="fonts-family-check" />
                    </span>
                  </button>
                  <div class="fonts-variants">
                    <div
                      v-for="f in fontFiles.filter(ff => ff.family === family)"
                      :key="f.key"
                      class="fonts-variant"
                      :class="{ loaded: f.loaded }"
                    >
                      <span class="fonts-variant-dot" />
                      <span class="fonts-variant-label">{{ f.weight }}{{ f.style === 'italic' ? 'i' : '' }}</span>
                      <span v-if="f.subsetCount > 1" class="fonts-variant-count">&times;{{ f.subsetCount }}</span>
                      <template v-if="f.subsets.length">
                        <span v-for="s in f.subsets" :key="s" class="fonts-subset-chip">{{ s }}</span>
                      </template>
                    </div>
                  </div>
                </template>
              </div>

              <div v-else class="fonts-empty">
                No fonts resolved. Install <code class="inline-code">@nuxt/fonts</code> to enable.
              </div>
            </div>

            <!-- useSeoMeta snippet for meta tag overrides -->
            <div v-if="protoTab === 'meta-tags' && hasMetaOverrides" class="snippet-wrapper">
              <div class="snippet-header">
                <code class="snippet-label">useSeoMeta</code>
                <UButton
                  variant="ghost"
                  color="neutral"
                  size="xs"
                  :icon="snippetCopied ? 'carbon:checkmark' : 'carbon:copy'"
                  @click="copySnippet"
                />
              </div>
              <OCodeBlock :code="seoMetaSnippet" lang="js" class="snippet-block" />
            </div>

            <UAlert
              v-else-if="hasMadeChanges && protoTab !== 'meta-tags'"
              color="warning"
              variant="subtle"
              icon="carbon:warning"
              title="Unsaved changes"
              description="These changes are for preview only and won't persist."
              class="mx-3 my-2"
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

.preview-container:hover {
  border-color: var(--color-border);
  box-shadow: none;
}

@media (max-height: 600px) {
  .preview-container {
    height: 100vh;
    min-height: 0;
    border-radius: 0;
    border-left: 0;
    border-right: 0;
  }
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
  position: relative;
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

/* Component info */
.component-info {
  position: absolute;
  left: 50%;
  top: 50%;
  transform: translate(-50%, -50%);
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.8125rem;
}

.component-path-link {
  font-size: 0.8125rem;
  font-family: var(--font-mono, ui-monospace, monospace);
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
  transition: padding 200ms cubic-bezier(0.22, 1, 0.36, 1);
}

@media (min-width: 640px) {
  .preview-area {
    padding: 1.5rem;
  }

  .preview-area--panel-open {
    padding-right: 20rem;
  }
}

.preview-content {
  width: 100%;
  max-width: 42rem;
  margin: 0 auto;
}

@media (max-height: 600px) {
  .preview-area {
    padding: 0.5rem;
    overflow: hidden;
  }

  .preview-content {
    max-width: 100%;
    /* Scale cards to fit available height — toolbar ~40px, tabs ~36px, padding 16px */
    max-height: calc(100vh - 160px);
    display: flex;
    flex-direction: column;
    justify-content: center;
  }

  /* Constrain all card renderers to fit viewport height */
  .preview-content :deep(img) {
    max-height: calc(100vh - 280px);
    width: auto;
    object-fit: contain;
  }

  .preview-content :deep(.discord-image),
  .preview-content :deep(.facebook-image),
  .preview-content :deep(.linkedin-image),
  .preview-content :deep(.bluesky-image),
  .preview-content :deep(.slack-image) {
    max-height: calc(100vh - 280px);
  }
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

@media (max-height: 600px) {
  .status-line {
    margin-top: 0.375rem;
    font-size: 0.6875rem;
  }
}

/* Props panel */
.props-panel {
  position: absolute;
  right: 0.75rem;
  top: 7rem;
  bottom: 0.75rem;
  width: 18rem;
  z-index: 10;
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

@media (max-height: 600px) {
  .props-panel {
    top: 5.5rem;
    bottom: 0.25rem;
    right: 0.25rem;
    border-radius: var(--radius-md);
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

.props-field {
  padding: 0.375rem 0.75rem;
}

.props-field-label {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  font-size: 0.6875rem;
  font-weight: 500;
  color: var(--color-text-muted);
  margin-bottom: 0.25rem;
  text-transform: uppercase;
  letter-spacing: 0.03em;
}

/* Empty state */
.empty-state-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 4rem;
  height: 4rem;
  border-radius: var(--radius-lg);
  background: oklch(65% 0.2 145 / 0.12);
  color: var(--seo-green);
  margin-bottom: 1.5rem;
}

.dark .empty-state-icon {
  background: oklch(65% 0.2 145 / 0.15);
}

.empty-state-icon--error {
  background: oklch(55% 0.2 25 / 0.12);
  color: oklch(55% 0.2 25);
}

.dark .empty-state-icon--error {
  background: oklch(55% 0.2 25 / 0.15);
  color: oklch(75% 0.15 25);
}

/* Fonts tab */
.fonts-tab {
  display: flex;
  flex-direction: column;
}

/* Detected requirements — compact summary bar */
.fonts-detected {
  padding: 0.5rem 0.75rem;
  border-bottom: 1px solid var(--color-border-subtle);
}

.fonts-detected-inner {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.25rem;
}

.fonts-detected-label {
  font-family: var(--font-mono);
  font-size: 0.5625rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--color-text-subtle);
  margin-right: 0.125rem;
}

.fonts-chip {
  display: inline-flex;
  align-items: center;
  gap: 0.1875rem;
  padding: 0.0625rem 0.3125rem;
  font-family: var(--font-mono);
  font-size: 0.625rem;
  line-height: 1.4;
  border-radius: 3px;
  background: var(--color-surface-sunken);
  border: 1px solid var(--color-border-subtle);
  color: var(--color-text-muted);
}

.fonts-chip--family {
  color: var(--seo-green);
  border-color: oklch(65% 0.2 145 / 0.2);
  background: oklch(65% 0.2 145 / 0.06);
}

.dark .fonts-chip--family {
  background: oklch(65% 0.2 145 / 0.1);
}

.fonts-chip--error {
  color: oklch(55% 0.2 25);
  border-color: oklch(55% 0.2 25 / 0.25);
  background: oklch(55% 0.2 25 / 0.08);
}

.dark .fonts-chip--error {
  color: oklch(75% 0.15 25);
  background: oklch(55% 0.2 25 / 0.12);
}

.fonts-resolved {
  border-bottom: none;
  padding-top: 0;
}

.fonts-detected + .fonts-resolved {
  padding-top: 0;
}

.fonts-detected-sep {
  width: 1px;
  height: 0.75rem;
  background: var(--color-border);
  margin: 0 0.125rem;
  flex-shrink: 0;
}

/* Font specimen list */
.fonts-specimen {
  display: flex;
  flex-direction: column;
}

.fonts-family-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  padding: 0.375rem 0.75rem;
  background: transparent;
  border: none;
  cursor: pointer;
  transition: background 150ms cubic-bezier(0.22, 1, 0.36, 1);
}

.fonts-family-row:hover {
  background: var(--color-surface-sunken);
}

.fonts-family-row.active {
  background: oklch(65% 0.2 145 / 0.06);
}

.dark .fonts-family-row.active {
  background: oklch(65% 0.2 145 / 0.08);
}

.fonts-family-name {
  font-size: 0.8125rem;
  font-weight: 500;
  color: var(--color-text);
  line-height: 1.3;
}

.fonts-family-row.active .fonts-family-name {
  color: var(--seo-green);
}

.fonts-family-meta {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  flex-shrink: 0;
}

.fonts-family-size {
  font-family: var(--font-mono);
  font-size: 0.5625rem;
  color: var(--color-text-subtle);
  letter-spacing: 0.01em;
}

.fonts-family-check {
  width: 0.875rem;
  height: 0.875rem;
  color: var(--seo-green);
  flex-shrink: 0;
}

.fonts-variants {
  display: flex;
  flex-wrap: wrap;
  gap: 0.375rem 0.625rem;
  padding: 0.125rem 0.75rem 0.5rem 1rem;
  border-bottom: 1px solid var(--color-border-subtle);
}

.fonts-variant {
  display: flex;
  align-items: baseline;
  gap: 0.25rem;
  flex-wrap: wrap;
}

.fonts-variant-dot {
  width: 5px;
  height: 5px;
  border-radius: 50%;
  flex-shrink: 0;
  background: var(--color-border);
  align-self: center;
}

.fonts-variant.loaded .fonts-variant-dot {
  background: var(--seo-green);
}

.fonts-variant-label {
  font-family: var(--font-mono);
  font-size: 0.625rem;
  color: var(--color-text-subtle);
  line-height: 1;
}

.fonts-variant.loaded .fonts-variant-label {
  color: var(--color-text-muted);
}

.fonts-variant-count {
  font-family: var(--font-mono);
  font-size: 0.5625rem;
  color: var(--color-text-subtle);
  opacity: 0.7;
}

.fonts-subset-chip {
  font-family: var(--font-mono);
  font-size: 0.5rem;
  line-height: 1;
  padding: 0.0625rem 0.1875rem;
  border-radius: 2px;
  background: var(--color-surface-sunken);
  border: 1px solid var(--color-border-subtle);
  color: var(--color-text-subtle);
}

.fonts-variant.loaded .fonts-subset-chip {
  color: var(--color-text-muted);
}

.fonts-empty {
  padding: 1rem 0.75rem;
  font-size: 0.75rem;
  color: var(--color-text-subtle);
  text-align: center;
}

/* Snippet block */
.snippet-wrapper {
  margin: 0.5rem 0.75rem;
}

.snippet-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 0.375rem;
}

.snippet-label {
  font-family: var(--font-mono);
  font-size: 0.6875rem;
  font-weight: 500;
  color: var(--color-text-muted);
  letter-spacing: -0.01em;
}

.snippet-block {
  border-radius: var(--radius-sm);
  font-size: 0.6875rem;
  line-height: 1.6;
  padding: 0.5rem 0.625rem !important;
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
