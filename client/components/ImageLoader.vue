<script setup lang="ts">
import { onMounted, ref, watch } from '#imports'

const props = defineProps<{
  src: string
  aspectRatio: number
  maxHeight?: number
  maxWidth?: number
}>()
// emits a load event
const emit = defineEmits(['load'])

const image = ref()

function setSource(src: string) {
  const img = image.value as HTMLImageElement
  if (src !== img.src) {
    const now = Date.now()
    img.src = ''
    img.style.opacity = '0'
    img.onload = () => {
      img.style.opacity = '1'
      emit('load', Date.now() - now)
    }
    img.src = src
  }
}

onMounted(() => {
  watch(() => props.src, (src) => {
    setSource(src!)
  }, {
    immediate: true,
  })
})
</script>

<template>
  <img ref="image" :style="{ aspectRatio }">
</template>

<style scoped>
img {
  max-height: 100%;
  height: auto !important;
  width: auto !important;
  margin: 0 auto;
  max-width: 100%;
  transition: 0.4s ease-in-out;
}
</style>
