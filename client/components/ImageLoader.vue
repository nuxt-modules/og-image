<script setup lang="ts">
import { computed, onMounted, ref, watch } from '#imports'
import { description } from '~/util/logic'

const props = defineProps({
  src: String,
  aspectRatio: Number,
  description: String,
})

const image = ref()
const timeTakenMs = ref(0)

function setSource(src: string) {
  const img = image.value as HTMLImageElement
  const now = Date.now()
  img.src = ''
  timeTakenMs.value = 0
  img.style.opacity = '0'
  img.onload = () => {
    img.style.opacity = '1'
    timeTakenMs.value = Date.now() - now
  }
  img.src = src
}

onMounted(() => {
  watch(() => props.src, (src) => {
    setSource(src!)
  }, {
    immediate: true,
  })
})

const loadDescription = computed(() => props.description!.replace('%s', timeTakenMs.value.toString()))
watch(loadDescription, (d) => {
  description.value = d
})
</script>

<template>
  <img ref="image" class="max-h-full border-1 border-light-500 rounded" :style="{ aspectRatio }">
</template>

<style scoped>
img {
  height: auto !important;
  width: auto !important;
  margin: 0 auto;
  max-width: 100%;
  transition: 0.4s ease-in-out;
}
</style>
