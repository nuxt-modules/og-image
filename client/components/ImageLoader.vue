<script setup lang="ts">
import { ref, watch } from '#imports'

const props = defineProps<{
  src: string
  aspectRatio: number
  maxHeight?: number
  maxWidth?: number
  minHeight?: number
}>()

const emit = defineEmits(['load'])

const error = ref<string[] | false>(false)
const loading = ref(true)
const loadStart = ref(0)

watch(() => props.src, () => {
  loading.value = true
  error.value = false
  loadStart.value = Date.now()
}, { immediate: true })

function onLoad() {
  loading.value = false
  emit('load', { timeTaken: Date.now() - loadStart.value, sizeKb: '' })
}

function onError() {
  loading.value = false
  $fetch(props.src).catch((err: { data?: { stack?: string[] } }) => {
    error.value = err.data?.stack || ['Failed to load image']
  })
}
</script>

<template>
  <div
    class="image-loader"
    :style="{ aspectRatio, minHeight }"
    :class="{
      'is-valid': !error && !loading,
      'is-error': error,
    }"
  >
    <img
      v-show="!loading && !error"
      :src="src"
      :style="{ aspectRatio }"
      @load="onLoad"
      @error="onError"
    >

    <!-- Loading state -->
    <div v-if="loading" class="loading-state">
      <div class="loading-spinner" />
    </div>

    <!-- Error state -->
    <div v-if="error" class="error-state">
      <div class="error-header">
        <UIcon name="carbon:warning" class="error-icon" />
        <span class="error-type">
          {{ error.join('\n').includes('satori') ? 'SatoriError' : 'ImageError' }}
        </span>
      </div>
      <p class="error-message">
        {{ error[0]?.replace('Error:', '') }}
      </p>
      <pre v-if="error.length > 1" class="error-stack">{{ error.slice(1).join('\n') }}</pre>
    </div>
  </div>
</template>

<style scoped>
.image-loader {
  height: 100%;
  margin: 0 auto;
  width: 100%;
  transition: all 300ms cubic-bezier(0.22, 1, 0.36, 1);
  border-radius: var(--radius-md);
  overflow: hidden;
  background: var(--color-surface-sunken);
}

.image-loader img {
  width: 100%;
  height: 100%;
  max-width: 1200px;
  object-fit: contain;
  background: var(--color-surface-sunken);
  border-radius: var(--radius-md);
}

.image-loader.is-valid {
  cursor: pointer;
}

.image-loader.is-valid:hover {
  box-shadow: 0 4px 20px oklch(0% 0 0 / 0.1);
}

.dark .image-loader.is-valid:hover {
  box-shadow: 0 4px 20px oklch(0% 0 0 / 0.3);
}

/* Loading state */
.loading-state {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  min-height: 200px;
}

.loading-spinner {
  width: 2rem;
  height: 2rem;
  border: 2px solid var(--color-border);
  border-top-color: var(--seo-green);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

/* Error state */
.image-loader.is-error {
  overflow-x: auto;
  background: oklch(97% 0.015 25);
  border: 1px solid oklch(90% 0.05 25);
}

.dark .image-loader.is-error {
  background: oklch(18% 0.02 25);
  border-color: oklch(28% 0.04 25);
}

.error-state {
  padding: 1.25rem;
}

.error-header {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.375rem 0.75rem;
  font-size: 0.75rem;
  font-weight: 600;
  color: oklch(50% 0.15 25);
  background: oklch(92% 0.06 25);
  border-radius: var(--radius-sm);
  margin-bottom: 1rem;
}

.dark .error-header {
  color: oklch(80% 0.1 25);
  background: oklch(28% 0.06 25);
}

.error-icon {
  font-size: 0.875rem;
}

.error-message {
  font-size: 0.9375rem;
  font-weight: 600;
  margin-bottom: 1rem;
  line-height: 1.5;
  color: var(--color-text);
}

.error-stack {
  font-size: 0.75rem;
  font-family: var(--font-mono);
  color: var(--color-text-muted);
  white-space: pre-wrap;
  word-break: break-all;
  line-height: 1.6;
}
</style>
