<script setup lang="ts">
import { useDebounceFn } from '@vueuse/core'
import { containerWidth, description } from '~/util/logic'

const props = defineProps({
  src: String,
  aspectRatio: Number,
  description: String,
})

defineEmits(['refresh'])

const iframe = ref()
const timeTakenMs = ref(0)

const setSource = useDebounceFn(() => {
  let frame = iframe.value as HTMLImageElement
  if (!frame)
    frame = document.querySelector('#iframe-loader')
  const now = Date.now()
  frame.src = ''
  const parentHeight = frame.offsetHeight
  const parentWidth = frame.offsetWidth
  const parentHeightScale = parentHeight > 630 ? 1 : parentHeight / 630
  const parentWidthScale = parentWidth > 1200 ? 1 : parentWidth / 1200
  const scale = parentWidthScale > parentHeightScale ? parentHeightScale : parentWidthScale
  timeTakenMs.value = 0
  frame.style.opacity = '0'
  frame.onload = () => {
    frame.style.opacity = '1'
    timeTakenMs.value = Date.now() - now
  }
  frame.src = `${props.src}&scale=${scale}`
}, 200)

onMounted(() => {
  watch(() => props.src, (src) => {
    setSource()
  }, {
    immediate: true,
  })

  watch(() => containerWidth.value, () => {
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

const loadDescription = computed(() => props.description!.replace('%s', timeTakenMs.value.toString()))
watch(loadDescription, (d) => {
  description.value = d
})
</script>

<template>
  <iframe id="iframe-loader" ref="iframe" class="max-h-full" :style="{ aspectRatio }" width="1200" height="630" />
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
