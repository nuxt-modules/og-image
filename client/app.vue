<script lang="ts" setup>
import { computed, useHead, useRoute } from '#imports'
import CreateOgImageDialog from './components/CreateOgImageDialog.vue'
import { useOgImage } from './composables/og-image'
import { colorMode } from './composables/rpc'
import { loadShiki } from './composables/shiki'
import 'floating-vue/dist/style.css'
import 'vanilla-jsoneditor/themes/jse-theme-dark.css'
import 'splitpanes/dist/splitpanes.css'

useHead({
  title: 'Nuxt OG Image',
})
await loadShiki()

const {
  globalDebug,
  pending,
  error,
  isPageScreenshot,
  refreshSources,
  resetProps,
} = useOgImage()

await resetProps(false)

const isDark = computed(() => colorMode.value === 'dark')
useHead({
  htmlAttrs: {
    class: () => isDark.value ? 'dark' : '',
  },
})

const route = useRoute()
const currentTab = computed(() => {
  const path = route.path
  if (path === '/templates')
    return 'templates'
  if (path === '/debug')
    return 'debug'
  if (path === '/docs')
    return 'docs'
  return 'design'
})
</script>

<template>
  <div class="relative n-bg-base flex flex-col min-h-screen">
    <div class="gradient-bg" />
    <CreateOgImageDialog />
    <header class="header sticky top-0 z-10 px-5 py-3">
      <div class="flex justify-between items-center">
        <div class="flex items-center gap-4">
          <a href="https://nuxtseo.com" target="_blank" class="flex items-center">
            <NuxtSeoLogo />
          </a>
          <div class="h-5 w-px bg-neutral-300 dark:bg-neutral-700" />
          <div class="flex items-center gap-2">
            <h1 class="text-base font-semibold tracking-tight flex items-center gap-2">
              <NIcon icon="carbon:image-search" class="text-green-500" />
              OG Image
            </h1>
            <NBadge class="text-xs font-medium">
              {{ globalDebug?.runtimeConfig?.version }}
            </NBadge>
          </div>
        </div>
        <nav class="flex items-center gap-2">
          <fieldset class="nav-tabs flex items-center rounded-lg overflow-hidden border border-neutral-200 dark:border-neutral-800">
            <NuxtLink
              v-for="(item, idx) of [
                { value: 'design', to: '/', icon: 'carbon:brush-freehand', label: 'Design' },
                { value: 'templates', to: '/templates', icon: 'carbon:image', label: 'Templates' },
                { value: 'debug', to: '/debug', icon: 'carbon:debug', label: 'Debug' },
                { value: 'docs', to: '/docs', icon: 'carbon:book', label: 'Docs' },
              ]"
              :key="item.value"
              :to="item.to"
              class="nav-tab relative cursor-pointer block"
              :class="[
                idx ? 'border-l border-neutral-200 dark:border-neutral-800' : '',
                currentTab === item.value ? 'active' : '',
                isPageScreenshot && item.value === 'templates' ? 'hidden' : '',
                (pending || error ? 'opacity-50 pointer-events-none' : ''),
              ]"
            >
              <VTooltip>
                <div class="px-4 py-2 flex items-center gap-1.5 text-sm">
                  <NIcon :icon="item.icon" :class="currentTab === item.value ? 'text-green-500' : 'opacity-50'" />
                  <span class="hidden sm:inline" :class="currentTab === item.value ? '' : 'opacity-60'">{{ item.label }}</span>
                </div>
                <template #popper>
                  {{ item.label }}
                </template>
              </VTooltip>
            </NuxtLink>
          </fieldset>
          <VTooltip>
            <button type="button" class="nav-btn p-2 rounded-lg transition-colors" @click="refreshSources">
              <NIcon icon="carbon:reset" class="text-lg" />
            </button>
            <template #popper>
              Refresh
            </template>
          </VTooltip>
          <div class="hidden lg:flex items-center gap-3 ml-2">
            <NLink href="https://github.com/nuxt-modules/og-image" target="_blank" class="nav-btn p-2 rounded-lg">
              <NIcon icon="simple-icons:github" class="text-lg" />
            </NLink>
          </div>
        </nav>
      </div>
    </header>
    <div class="flex-row flex p4 h-full" style="min-height: calc(100vh - 64px);">
      <main class="mx-auto flex flex-col w-full">
        <NuxtPage />
      </main>
    </div>
  </div>
</template>

<style>
/* Layout */
.tab-panels {
  width: 100%;
}
div[role="tabpanel"] {
  width: 100%;
  display: flex;
}

/* Splitpanes */
.splitpanes.default-theme .splitpanes__pane {
  background-color: transparent !important;
}
.dark .splitpanes.default-theme .splitpanes__splitter {
  background-color: transparent !important;
  border-left: 1px solid oklch(27.9% 0.041 285 / 0.3);
}
.dark .splitpanes.default-theme .splitpanes__splitter:before,
.splitpanes.default-theme .splitpanes__splitter:after {
  background-color: oklch(55.4% 0.046 285 / 0.3) !important;
}

/* Header */
.header {
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  background: oklch(100% 0 0 / 0.85);
  border-bottom: 1px solid oklch(92.9% 0.013 285);
}
.dark .header {
  background: oklch(12.9% 0.042 285 / 0.85);
  border-bottom-color: oklch(20.8% 0.042 285);
}

/* Navigation tabs */
.nav-tabs {
  background: oklch(98.4% 0.003 285);
}
.dark .nav-tabs {
  background: oklch(20.8% 0.042 285);
}
.nav-tab {
  transition: all 0.15s ease;
}
.nav-tab:hover {
  background: oklch(96.8% 0.007 285);
}
.dark .nav-tab:hover {
  background: oklch(27.9% 0.041 285);
}
.nav-tab.active {
  background: oklch(94% 0.04 145 / 0.15);
}
.dark .nav-tab.active {
  background: oklch(30% 0.06 145 / 0.2);
}

/* Navigation button */
.nav-btn {
  color: oklch(55.4% 0.046 285);
  transition: all 0.15s ease;
}
.nav-btn:hover {
  background: oklch(96.8% 0.007 285);
  color: oklch(37.2% 0.044 285);
}
.dark .nav-btn:hover {
  background: oklch(27.9% 0.041 285);
  color: oklch(86.9% 0.022 285);
}

/* Base HTML */
html {
  --at-apply: font-sans;
  overflow-y: scroll;
  overscroll-behavior: none;
}
body {
  min-height: 100vh;
}
html.dark {
  background: oklch(12.9% 0.042 285);
  color-scheme: dark;
}

/* Typography */
.n-markdown a {
  --at-apply: text-primary hover:underline;
}
.prose a {
  --uno: hover:text-primary;
}
.prose code::before,
.prose code::after {
  content: "";
}
.prose hr {
  --uno: border-solid border-1 border-b border-base h-1px w-full block my-2 op50;
}

textarea {
  background: oklch(96.8% 0.007 285);
}
.dark textarea {
  background: oklch(20.8% 0.042 285);
}

/* JSON Editor theme */
:root {
  --jse-theme-color: oklch(100% 0 0) !important;
  --jse-text-color-inverse: oklch(55.4% 0.046 285) !important;
  --jse-theme-color-highlight: oklch(96.8% 0.007 285) !important;
  --jse-panel-background: oklch(100% 0 0) !important;
  --jse-background-color: var(--jse-panel-background) !important;
  --jse-error-color: oklch(65% 0.25 25 / 0.3) !important;
  --jse-main-border: none !important;
}
.dark,
.jse-theme-dark {
  --jse-panel-background: oklch(15% 0.042 285) !important;
  --jse-theme-color: oklch(15% 0.042 285) !important;
  --jse-text-color-inverse: oklch(86.9% 0.022 285) !important;
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
  border-radius: 8px !important;
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
  background: transparent;
}
::-webkit-scrollbar-thumb {
  background: oklch(70.4% 0.04 285 / 0.3);
  border-radius: 3px;
  transition: background 0.2s ease;
}
::-webkit-scrollbar-thumb:hover {
  background: oklch(55.4% 0.046 285 / 0.5);
}
.no-scrollbar::-webkit-scrollbar {
  display: none;
  width: 0 !important;
  height: 0 !important;
}
</style>
