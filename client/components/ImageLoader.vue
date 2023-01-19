<script setup lang="ts">
const props = defineProps({
  src: String,
  width: Number,
  height: Number,
  description: String,
})

defineEmits(['refresh'])

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
</script>

<template>
  <div class="w-full rounded border-2 border-light-700 dark:border-dark-800 shadow">
    <img ref="image" class="max-h-full" :width="width" :height="height" :style="{ width: `100%`, height: `auto`, margin: '0 auto' }">
    <div class="bg-light-500 dark:bg-dark-200 px-2 pt-2 pb-1 text-xs opacity-60 flex justify-between">
      <template v-if="timeTakenMs !== 0">
        <span>{{ loadDescription }}</span>
        <button @click="$emit('refresh')">
          Refresh
        </button>
      </template>
      <span v-else>
        Loading...
      </span>
    </div>
  </div>
</template>

<style scoped>
img {
  max-width: 1200px;
  aspect-ratio: 40 / 21;
  transition: 0.4s ease-in-out;
}
</style>
