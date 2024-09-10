<script setup lang="ts">
import { colorMode, computed, onMounted, ref, useHead, watch } from '#imports'
import { useDebounceFn } from '@vueuse/core'
import { options } from '~/util/logic'

const props = defineProps<{
  src: string
  aspectRatio: number
  maxHeight?: number
  maxWidth?: number
}>()
const emit = defineEmits(['load'])

const src = ref()

const iframe = ref()

const maxWidth = computed(() => {
  return props.maxWidth || options.value.width
})
const maxHeight = computed(() => {
  return props.maxHeight || options.value.height
})

const setSource = useDebounceFn(() => {
  const frame = iframe.value as HTMLImageElement
  const now = Date.now()
  frame.src = ''
  const width = options.value.width || 1200
  const height = options.value.height || 600
  const parentHeight = maxHeight.value // frame.offsetHeight
  const parentWidth = maxWidth.value // frame.offsetWidth
  const parentHeightScale = parentHeight > height ? 1 : parentHeight / height
  const parentWidthScale = parentWidth > width ? 1 : parentWidth / width
  const scale = parentWidthScale > parentHeightScale ? parentHeightScale : parentWidthScale
  frame.style.opacity = '0'
  frame.onload = () => {
    frame.style.opacity = '1'
    emit('load', { timeTaken: Date.now() - now })
  }
  frame.src = `${src.value}&scale=${scale}&colorMode=${colorMode.value}`
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

  watch([() => colorMode, iframe], () => {
    setSource()
  })
})

// unconstained, we need to resize
if (!props.maxHeight && !props.maxWidth) {
  useHead({
    bodyAttrs: {
      onresize: () => {
        setSource()
      },
    },
  })
}
</script>

<template>
  <div class="w-full mx-auto h-full justify-center flex" :style="{ maxHeight: `${maxHeight}px`, maxWidth: `${maxWidth}px` }">
    <iframe ref="iframe" class="max-h-full" :style="{ aspectRatio }" :width="maxWidth" :height="maxHeight" />
  </div>
</template>

<style scoped>
iframe {
  height: auto;
  width: auto;
  margin: 0 auto;
  transition: 0.4s ease-in-out;
  max-width: 100%;
}
</style>
