<script setup lang="ts">
import { onMounted, ref, watch } from '#imports'

const props = defineProps<{
  src: string
  aspectRatio: number
  maxHeight?: number
  minHeight?: number
  maxWidth?: number
}>()
// emits a load event
const emit = defineEmits(['load'])

const image = ref()
const error = ref<string[] | false>(false)
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
    }).catch((err) => {
      const res = err.response
      // res is a data blob we need to convert to json
      if (res && res._data) {
        const reader = new FileReader()
        reader.readAsText(res._data)
        reader.onloadend = () => {
          error.value = JSON.parse(reader.result)?.stack as string[]
          error.value.slice(1)
        }
      }
    }).finally(() => {
      loading.value = false
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
  <div
    ref="image" :style="{ aspectRatio, minHeight }" :class="{
      ['data-valid']: !error && !loading,
      ['data-error']: error,
    }"
  >
    <NLoading v-if="loading" />
    <div v-if="error" class="p-3">
      <p class="text-red-500 font-bold tracking-tight text-sm mb-1">
        {{ error.join('\n').includes('satori') ? 'SatoriError' : 'ImageError' }}
      </p>
      <p class="text-black dark:text-white text-md font-bold mb-5">
        {{ error[0].replace('Error:', '') }}
      </p>
      <pre>{{ error.slice(1).join('\n') }}</pre>
    </div>
  </div>
</template>

<style scoped>
div {
  height: 100%;
  margin: 0 auto;
  width: 100%;
  transition: 0.4s ease-in-out;
}
div[class~="data-valid"] {
  cursor: pointer;
  background-color: transparent;
  background-color: white;
  background-size: contain;
}
div[class~="data-error"] {
  overflow-x: auto;
}
div[class~="data-error"] :deep(.shiki) {
  white-space: normal;
}
</style>
