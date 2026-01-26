<script setup lang="ts">
import { onMounted, ref, toValue, watch } from '#imports'
import { useDebounceFn, useResizeObserver } from '@vueuse/core'
import { withQuery } from 'ufo'
import { options } from '../util/logic'

const props = defineProps<{
  src: string
  aspectRatio: number
}>()
const emit = defineEmits(['load'])

const src = ref()
const iframe = ref<HTMLIFrameElement>()
const container = ref<HTMLElement>()

const setSource = useDebounceFn(() => {
  const frame = iframe.value
  if (!frame || !src.value)
    return
  const now = Date.now()
  frame.src = ''

  // Calculate scale based on container width vs content width
  const contentWidth = toValue(options.value.width) || 1200
  const containerWidth = container.value?.offsetWidth
  // Use scale 1 if container hasn't rendered yet (offsetWidth is 0)
  const scale = containerWidth ? Math.min(1, containerWidth / contentWidth) : 1

  frame.style.opacity = '0'
  frame.onload = () => {
    frame.style.opacity = '1'
    emit('load', { timeTaken: Date.now() - now })
  }
  frame.src = withQuery(src.value, { scale })
}, 200)

onMounted(() => {
  watch(() => props.src, (val) => {
    if (src.value !== val) {
      if (iframe.value) {
        src.value = val
        setSource()
      }
    }
  }, {
    immediate: true,
  })

  watch(iframe, () => {
    setSource()
  })
})

// Recalculate scale when container resizes
useResizeObserver(container, () => {
  if (src.value)
    setSource()
})
</script>

<template>
  <div ref="container" class="iframe-loader" :style="{ aspectRatio }">
    <iframe ref="iframe" />
  </div>
</template>

<style scoped>
.iframe-loader {
  position: relative;
  width: 100%;
  max-width: 1200px;
  margin: 0 auto;
  border-radius: var(--radius-md);
  overflow: hidden;
  background: var(--color-surface-sunken);
}

.iframe-loader iframe {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  border: none;
  transition: opacity 0.3s ease;
}
</style>
