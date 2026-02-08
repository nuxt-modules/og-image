<script lang="ts" setup>
import type { RendererType } from '../../src/runtime/types'
import { computed } from 'vue'
import { useOgImage } from '../composables/og-image'
import { RendererSelectDialogPromise } from '../composables/renderer-select'

const {
  globalDebug,
  renderer,
  imageFormat,
  availableRenderers,
  isPageScreenshot,
  getComponentVariantForRenderer,
  patchOptions,
} = useOgImage()

function switchRendererAndFormat(newRenderer: RendererType, extension: 'png' | 'jpeg' | 'jpg' | 'svg' | 'html') {
  const variant = getComponentVariantForRenderer(newRenderer)
  if (variant) {
    patchOptions({ renderer: newRenderer, extension, component: variant.pascalName })
  }
  else {
    patchOptions({ renderer: newRenderer, extension })
  }
}

const formatDescriptions: Record<string, string> = {
  png: 'Lossless, best compatibility across all platforms.',
  svg: 'Vector output. Smallest size, satori only.',
  html: 'Raw HTML preview for debugging templates.',
  jpg: 'Lossy compression. Smaller file size via Sharp.',
}

interface FormatItem {
  label: string
  value: string
  description: string
}

interface RendererConfig {
  name: RendererType
  label: string
  icon: string
  iconType: 'component' | 'img'
  description: string
  available: boolean
  binding: string | false
  formats: FormatItem[]
  disabledReason: string | null
  installCommand: string | null
}

const rendererConfigs = computed<RendererConfig[]>(() => {
  const compat = globalDebug.value?.compatibility
  const hasSharp = compat?.sharp
  const hasBrowser = availableRenderers.value.has('browser')
  const hasSatori = availableRenderers.value.has('satori')
  const hasTakumi = availableRenderers.value.has('takumi')

  function fmt(ext: string): FormatItem {
    return { label: ext.toUpperCase(), value: ext, description: formatDescriptions[ext] || '' }
  }

  return [
    {
      name: 'satori' as RendererType,
      label: 'Satori',
      icon: 'logos:vercel-icon',
      iconType: 'component' as const,
      description: 'SVG-based. Fast, works everywhere.',
      available: hasSatori,
      binding: compat?.satori || false,
      formats: [
        fmt('png'),
        fmt('svg'),
        ...(!isPageScreenshot.value ? [fmt('html')] : []),
        ...(hasSharp ? [fmt('jpg')] : []),
      ],
      disabledReason: !hasSatori ? 'No satori-compatible templates found' : null,
      installCommand: null,
    },
    {
      name: 'browser' as RendererType,
      label: 'Browser',
      icon: 'logos:chrome',
      iconType: 'component' as const,
      description: 'Headless Chrome screenshot. Full CSS support.',
      available: hasBrowser,
      binding: compat?.browser || false,
      formats: [
        fmt('png'),
        fmt('jpg'),
        ...(!isPageScreenshot.value ? [fmt('html')] : []),
      ],
      disabledReason: !hasBrowser ? 'Requires Playwright or Chrome' : null,
      installCommand: !hasBrowser ? 'npx playwright install chromium' : null,
    },
    {
      name: 'takumi' as RendererType,
      label: 'Takumi',
      icon: 'https://takumi.kane.tw/logo.svg',
      iconType: 'img' as const,
      description: 'Canvas-based renderer with rich styling.',
      available: hasTakumi,
      binding: compat?.takumi || false,
      formats: [
        fmt('png'),
        ...(!isPageScreenshot.value ? [fmt('html')] : []),
        ...(hasSharp ? [fmt('jpg')] : []),
      ],
      disabledReason: !hasTakumi ? 'Module not installed' : null,
      installCommand: !hasTakumi ? 'npx nuxi module add nuxt-og-image-takumi' : null,
    },
  ]
})

const sortedRendererConfigs = computed(() => {
  return [...rendererConfigs.value].sort((a, b) => {
    const aActive = renderer.value === a.name ? -1 : 0
    const bActive = renderer.value === b.name ? -1 : 0
    if (aActive !== bActive)
      return aActive - bActive
    if (a.available !== b.available)
      return a.available ? -1 : 1
    return 0
  })
})

const takumiMigrationAvailable = computed(() => {
  return renderer.value === 'satori' && availableRenderers.value.has('takumi') && getComponentVariantForRenderer('takumi')
})

function activeFormatValue(config: RendererConfig) {
  if (renderer.value !== config.name)
    return undefined
  return imageFormat.value === 'jpeg' ? 'jpg' : (imageFormat.value || 'png')
}

function onFormatChange(config: RendererConfig, ext: string, resolve: () => void) {
  switchRendererAndFormat(config.name, ext as 'png' | 'jpeg' | 'jpg' | 'svg' | 'html')
  resolve()
}

function switchToTakumi(resolve: () => void) {
  const variant = getComponentVariantForRenderer('takumi')
  if (variant) {
    patchOptions({ renderer: 'takumi', component: variant.pascalName })
    resolve()
  }
}
</script>

<template>
  <RendererSelectDialogPromise v-slot="{ resolve }">
    <UModal
      :open="true"
      title="Renderer & Format"
      @update:open="resolve()"
      @close="resolve()"
    >
      <template #body>
        <div class="renderer-cards stagger-children">
          <div
            v-for="config in sortedRendererConfigs"
            :key="config.name"
            class="renderer-card"
            :class="{
              active: renderer === config.name,
              disabled: !config.available,
            }"
          >
            <!-- Header -->
            <div class="renderer-card-header">
              <div class="flex items-center gap-2">
                <img
                  v-if="config.iconType === 'img'"
                  :src="config.icon"
                  class="w-4 h-4"
                  width="16"
                  height="16"
                  :alt="`${config.label} logo`"
                >
                <UIcon v-else :name="config.icon" class="w-4 h-4" aria-hidden="true" />
                <span class="font-medium text-sm text-[var(--color-text)]">{{ config.label }}</span>
                <UTooltip v-if="config.binding" :text="`Runtime: ${config.binding}`" :delay-duration="0">
                  <UBadge color="neutral" variant="subtle" size="xs" class="cursor-help">
                    {{ config.binding }}
                  </UBadge>
                </UTooltip>
              </div>
              <UBadge v-if="renderer === config.name && config.available" color="primary" variant="soft" size="xs">
                Active
              </UBadge>
            </div>

            <!-- Description -->
            <p class="text-xs text-[var(--color-text-muted)] mt-1">
              {{ config.description }}
            </p>

            <!-- Format radio group (available) -->
            <div v-if="config.available" class="format-section">
              <URadioGroup
                :model-value="activeFormatValue(config)"
                :items="config.formats"
                size="sm"
                indicator="start"
                @update:model-value="onFormatChange(config, $event as string, resolve)"
              />
            </div>

            <!-- Disabled state -->
            <div v-else class="disabled-info">
              <p class="text-xs text-[var(--color-text-subtle)]">
                {{ config.disabledReason }}
              </p>
              <div v-if="config.installCommand" class="install-block">
                <span class="install-label">
                  <UIcon name="carbon:terminal" class="w-3 h-3" aria-hidden="true" />
                  Install
                </span>
                <code class="install-command">{{ config.installCommand }}</code>
              </div>
            </div>

            <!-- Migration prompt (satori card only) -->
            <div v-if="config.name === 'satori' && takumiMigrationAvailable" class="migration-prompt">
              <div class="migration-prompt-inner">
                <div class="flex items-center gap-1.5">
                  <UIcon name="carbon:arrow-right" class="w-3 h-3 text-[var(--seo-green)]" aria-hidden="true" />
                  <span class="text-xs text-[var(--color-text-muted)]">Takumi variant available</span>
                </div>
                <UButton size="xs" variant="soft" color="primary" @click="switchToTakumi(resolve)">
                  Switch
                </UButton>
              </div>
            </div>
          </div>
        </div>
      </template>
    </UModal>
  </RendererSelectDialogPromise>
</template>

<style scoped>
.renderer-cards {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.renderer-card {
  padding: 0.875rem;
  border-radius: var(--radius-lg);
  border: 1px solid var(--color-border);
  background: var(--color-surface-elevated);
  transition: border-color 150ms, background 150ms, box-shadow 150ms;
}

.renderer-card:not(.disabled):hover {
  border-color: var(--color-neutral-300);
  box-shadow: 0 2px 8px oklch(0% 0 0 / 0.06);
}

:global(.dark) .renderer-card:not(.disabled):hover {
  border-color: var(--color-neutral-700);
  box-shadow: 0 2px 8px oklch(0% 0 0 / 0.2);
}

.renderer-card.active {
  border-color: var(--seo-green);
  background: oklch(65% 0.2 145 / 0.04);
}

:global(.dark) .renderer-card.active {
  background: oklch(65% 0.2 145 / 0.06);
}

.renderer-card.disabled {
  background: var(--color-surface-sunken);
}

.renderer-card.disabled .renderer-card-header,
.renderer-card.disabled > p {
  opacity: 0.55;
}

.renderer-card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.format-section {
  margin-top: 0.625rem;
}

.disabled-info {
  margin-top: 0.625rem;
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
}

.install-block {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  padding: 0.5rem;
  border-radius: var(--radius-sm);
  background: var(--color-surface-elevated);
  border: 1px solid var(--color-border);
}

.install-label {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  font-size: 0.6875rem;
  font-weight: 500;
  color: var(--color-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.03em;
}

.install-command {
  display: block;
  padding: 0.375rem 0.5rem;
  border-radius: var(--radius-sm);
  background: var(--color-surface-sunken);
  border: 1px solid var(--color-border-subtle);
  font-family: var(--font-mono);
  font-size: 0.75rem;
  color: var(--color-text);
  user-select: all;
}

.migration-prompt {
  margin-top: 0.625rem;
  padding-top: 0.625rem;
  border-top: 1px solid var(--color-border);
}

.migration-prompt-inner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.375rem 0.5rem;
  border-radius: var(--radius-sm);
  background: oklch(65% 0.2 145 / 0.06);
}

:global(.dark) .migration-prompt-inner {
  background: oklch(65% 0.2 145 / 0.08);
}
</style>
