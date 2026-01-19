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
    <NLoading v-if="loading" />
    <div v-if="error" class="error-container">
      <div class="error-badge">
        <NIcon icon="carbon:warning" class="text-sm" />
        {{ error.join('\n').includes('satori') ? 'SatoriError' : 'ImageError' }}
      </div>
      <p class="error-message">
        {{ error[0]?.replace('Error:', '') }}
      </p>
      <pre class="error-stack">{{ error.slice(1).join('\n') }}</pre>
    </div>
  </div>
</template>

<style>
.image-loader {
  height: 100%;
  margin: 0 auto;
  width: 100%;
  transition: all 0.3s ease;
  border-radius: 8px;
  overflow: hidden;
}

.image-loader img {
  width: 100%;
  height: 100%;
  max-width: 1200px;
  object-fit: contain;
  background: oklch(96% 0.01 285);
  border-radius: 8px;
}

.dark .image-loader img {
  background: oklch(22% 0.04 285);
}

.image-loader.is-valid {
  cursor: pointer;
}

.image-loader.is-error {
  overflow-x: auto;
  background: oklch(97% 0.015 25);
  border: 1px solid oklch(90% 0.05 25);
}

.dark .image-loader.is-error {
  background: oklch(20% 0.03 25);
  border-color: oklch(30% 0.05 25);
}

.image-loader.is-error .shiki {
  white-space: normal;
}

.error-container {
  padding: 16px;
}

.error-badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 10px;
  font-size: 12px;
  font-weight: 600;
  color: oklch(45% 0.15 25);
  background: oklch(90% 0.08 25);
  border-radius: 6px;
  margin-bottom: 12px;
}

.dark .image-loader .error-badge {
  color: oklch(85% 0.12 25);
  background: oklch(30% 0.08 25);
}

.error-message {
  font-size: 15px;
  font-weight: 600;
  margin-bottom: 16px;
  line-height: 1.4;
}

.error-stack {
  font-size: 12px;
  font-family: 'Fira Code', ui-monospace, monospace;
  opacity: 0.7;
  white-space: pre-wrap;
  word-break: break-all;
}
</style>
