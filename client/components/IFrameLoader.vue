<script setup lang="ts">
import { useDebounceFn } from '@vueuse/core'
import { computed, onMounted, ref, useColorMode, useHead, watch } from '#imports'
import { containerWidth, options } from '~/util/logic'

const props = defineProps<{
  src: string
  aspectRatio: number
  maxHeight?: number
  maxWidth?: number
}>()
const emit = defineEmits(['load'])

const src = ref(props.src)

const mode = useColorMode()

const iframe = ref()

const setSource = useDebounceFn(() => {
  let frame = iframe.value as HTMLImageElement
  if (!frame)
    frame = document.querySelector('#iframe-loader')
  const now = Date.now()
  frame.src = ''
  const width = options.value.width
  const height = options.value.height
  const parentHeight = frame.offsetHeight
  const parentWidth = frame.offsetWidth
  const parentHeightScale = parentHeight > height ? 1 : parentHeight / height
  const parentWidthScale = parentWidth > width ? 1 : parentWidth / width
  const scale = parentWidthScale > parentHeightScale ? parentHeightScale : parentWidthScale
  frame.style.opacity = '0'
  frame.onload = () => {
    frame.style.opacity = '1'
    emit('load', Date.now() - now)
  }
  frame.src = `${src.value}&scale=${scale}&mode=${mode.value}`
}, 200)

onMounted(() => {
  watch(() => props.src, (val) => {
    if (src.value !== val) {
      src.value = val
      setSource()
    }
  }, {
    immediate: true,
  })

  watch([() => containerWidth.value, mode], () => {
    setSource()
  })
})

useHead({
  bodyAttrs: {
    onresize: () => {
      setSource()
    },
  },
})

const maxWidth = computed(() => {
  return props.maxWidth || options.value.width
})
const maxHeight = computed(() => {
  return props.maxHeight || options.value.height
})
</script>

<template>
  <div class="w-full mx-auto h-full justify-center flex" :style="{ maxHeight: `${maxHeight}px`, maxWidth: `${maxWidth}px` }">
    <iframe id="iframe-loader" ref="iframe" class="max-h-full" :style="{ aspectRatio }" :width="maxWidth" :height="maxHeight" />
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
