<script setup lang="ts">
import { onMounted, ref, watch } from '#imports'

const props = defineProps<{
  src: string
  aspectRatio: number
  maxHeight?: number
  maxWidth?: number
  minHeight?: number
}>()
// emits a load event
const emit = defineEmits(['load'])

const image = ref()
const loading = ref(true)
const lastSrc = ref()

function setSource(src: string) {
  const img = image.value as HTMLImageElement
  if (src !== lastSrc.value) {
    lastSrc.value = src
    loading.value = true
    img.style.backgroundImage = ''
    img.style.backgroundRepeat = 'no-repeat'
    img.style.backgroundSize = 'contain'
    img.style.backgroundPosition = 'center'
    img.style.maxWidth = '1200px'
    const now = Date.now()
    // we want to do a fetch of the image so we can get the size of it in kb
    $fetch.raw(src, {
      responseType: 'blob',
    }).then((res) => {
      const size = res.headers.get('content-length')
      const kb = Math.round(Number(size) / 1024)
      // set the image source using base 64 of the response
      const reader = new FileReader()
      reader.readAsDataURL(res._data)
      reader.onloadend = () => {
        const base64data = reader.result
        if (base64data) {
          img.style.backgroundImage = `url(${base64data})`
          loading.value = false
          emit('load', { timeTaken: Date.now() - now, sizeKb: kb })
        }
      }
    })
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
  <div ref="image" :style="{ aspectRatio, minHeight }">
    <NLoading v-if="loading" />
  </div>
</template>

<style scoped>
div {
  cursor: pointer;
  height: 100%;
  margin: 0 auto;
  width: 100%;
  transition: 0.4s ease-in-out;
  background-color: white;
  background-size: contain;
}
</style>
