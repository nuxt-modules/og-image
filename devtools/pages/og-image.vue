<script lang="ts" setup>
import type { OgImageRuntimeConfig } from '../lib/og-image/runtime-types'
import type { GlobalDebugResponse, PathDebugResponse } from '../lib/og-image/types'
import defu from 'defu'
import { appFetch } from 'nuxtseo-layer-devtools/composables/rpc'
import { loadShiki } from 'nuxtseo-layer-devtools/composables/shiki'
import { path, productionUrl, query, refreshTime } from 'nuxtseo-layer-devtools/composables/state'
import { computed, provide, useAsyncData, useNuxtApp, useRoute, watch } from '#imports'
import AddComponentDialog from '../components/og-image/AddComponentDialog.vue'
import CreateOgImageDialog from '../components/og-image/CreateOgImageDialog.vue'
import RendererSelectModal from '../components/og-image/RendererSelectModal.vue'
import { GlobalDebugKey, PathDebugKey, PathDebugStatusKey, RefetchPathDebugKey } from '../lib/og-image/keys'
import { useOgImage } from '../lib/og-image/og-image'
import { encodeOgImageParams } from '../lib/og-image/shared/urlEncoding'
import { ogImageKey, options, optionsOverrides } from '../lib/og-image/util/logic'

const RE_IMAGE_EXT = /\.(png|jpeg|jpg|webp)$/

await loadShiki()

const nuxtApp = useNuxtApp()
nuxtApp.payload.data = nuxtApp.payload.data || {}

// @ts-expect-error untyped
const { data: globalDebug } = useAsyncData<GlobalDebugResponse>('og-image-global-debug', () => {
  if (!appFetch.value)
    return { runtimeConfig: {} as OgImageRuntimeConfig, componentNames: [] }
  return appFetch.value('/_og/debug.json')
}, {
  watch: [appFetch, refreshTime],
  default: () => ({ runtimeConfig: {} as OgImageRuntimeConfig, componentNames: [] }),
})

// Read og:image URL from host document — already has correct component/params from defineOgImage
function getHostOgImageDebugUrl(): string | undefined {
  try {
    const doc = window.parent?.document
    if (!doc)
      return
    const meta = doc.querySelector('meta[property="og:image"]') || doc.querySelector('meta[name="twitter:image"]')
    const content = meta?.getAttribute('content')
    if (!content?.includes('/_og/'))
      return
    return new URL(content).pathname.replace(RE_IMAGE_EXT, '.json')
  }
  catch {
    // Cross-origin parent documents cannot be inspected; fall back to route options.
  }
}

const { data: pathDebug, refresh: refreshPathDebug, status: pathDebugStatus } = useAsyncData<PathDebugResponse>('og-image-path-debug', async () => {
  if (!appFetch.value)
    return { extract: { options: [], socialPreview: { root: {}, images: [] } } }
  let url = getHostOgImageDebugUrl()
  if (!url) {
    const params = defu(
      { key: ogImageKey.value || 'og', _path: path.value, _query: query.value },
      optionsOverrides.value,
      options.value,
    )
    const encoded = encodeOgImageParams(params)
    url = `/_og/d/${encoded || 'default'}.json`
  }
  return (appFetch.value(url) as Promise<PathDebugResponse>).catch((err: any): PathDebugResponse => ({
    extract: { options: [], socialPreview: { root: {}, images: [] } },
    fetchError: {
      statusCode: err?.data?.statusCode || err?.statusCode,
      message: err?.data?.stack?.[0] || err?.data?.message || err?.message || 'Unknown error',
      stack: err?.data?.stack,
    },
  }))
}, {
  watch: [appFetch, path, refreshTime, ogImageKey],
  default: () => ({ extract: { options: [], socialPreview: { root: {}, images: [] } } }),
})

// Sync production URL from site config for production preview toggle
watch(globalDebug, (val) => {
  // @ts-expect-error globalDebug type doesn't include siteConfigUrl
  if (val?.siteConfigUrl)
    // @ts-expect-error globalDebug type doesn't include siteConfigUrl
    productionUrl.value = val.siteConfigUrl
}, { immediate: true })

// @ts-expect-error untyped
provide(GlobalDebugKey, globalDebug)
provide(PathDebugKey, pathDebug)
provide(PathDebugStatusKey, pathDebugStatus)
provide(RefetchPathDebugKey, refreshPathDebug)

const {
  isDebugLoading,
  error,
  refreshSources,
  resetProps,
} = useOgImage()

await resetProps(false)

const route = useRoute()
const currentTab = computed(() => {
  const p = route.path
  if (p === '/og-image/templates')
    return 'templates'
  if (p === '/og-image/debug')
    return 'debug'
  if (p === '/og-image/docs')
    return 'docs'
  return 'design'
})

const navItems = [
  { value: 'design', to: '/og-image', icon: 'carbon:brush-freehand', label: 'Design', devOnly: false },
  { value: 'templates', to: '/og-image/templates', icon: 'carbon:image', label: 'Templates', devOnly: false },
  { value: 'debug', to: '/og-image/debug', icon: 'carbon:debug', label: 'Debug', devOnly: true },
  { value: 'docs', to: '/og-image/docs', icon: 'carbon:book', label: 'Docs', devOnly: false },
]

const runtimeVersion = computed(() => {
  // @ts-expect-error untyped
  return globalDebug.value?.runtimeConfig?.version || 'unknown'
})
</script>

<template>
  <DevtoolsLayout
    module-name="nuxt-og-image"
    title="OG Image"
    icon="carbon:image-search"
    :version="runtimeVersion"
    :nav-items="navItems"
    github-url="https://github.com/nuxt-modules/og-image"
    :loading="isDebugLoading || !!error"
    :active-tab="currentTab"
    @refresh="refreshSources"
  >
    <AddComponentDialog />
    <CreateOgImageDialog />
    <RendererSelectModal />
    <NuxtPage />
  </DevtoolsLayout>
</template>

<style>
/* Textarea */
textarea {
  background: var(--color-surface-sunken);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
}

textarea:focus-visible {
  border-color: var(--seo-green);
  outline: none;
}

/* JSON Editor theme */
:root {
  --jse-theme-color: var(--color-surface-elevated) !important;
  --jse-text-color-inverse: var(--color-text-muted) !important;
  --jse-theme-color-highlight: var(--color-surface-sunken) !important;
  --jse-panel-background: var(--color-surface-elevated) !important;
  --jse-background-color: var(--jse-panel-background) !important;
  --jse-error-color: oklch(65% 0.2 25 / 0.3) !important;
  --jse-main-border: none !important;
}

.dark,
.jse-theme-dark {
  --jse-panel-background: var(--color-neutral-900) !important;
  --jse-theme-color: var(--color-neutral-900) !important;
  --jse-text-color-inverse: var(--color-neutral-300) !important;
  --jse-main-border: none !important;
}

.jse-main {
  min-height: 1em !important;
}

.jse-contents {
  border-width: 0 !important;
  border-radius: var(--radius-md) !important;
}
</style>
