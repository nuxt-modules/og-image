<script setup lang="ts">
const props = defineProps({
  src: String,
  width: Number,
  height: Number,
  description: String,
})

defineEmits(['refresh'])

const iframe = ref()
const timeTakenMs = ref(0)

function setSource(src: string) {
  const frame = iframe.value as HTMLImageElement
  const now = Date.now()
  frame.src = ''
  timeTakenMs.value = 0
  frame.style.opacity = '0'
  frame.onload = () => {
    frame.style.opacity = '1'
    timeTakenMs.value = Date.now() - now
  }
  frame.src = src
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
    <iframe ref="iframe" class="max-h-full w-full" :width="width" :height="height" :style="{ height: `auto`, margin: '0 auto' }" />
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
iframe {
  max-width: 1200px;
  transition: 0.4s;
  width: 100%;
  aspect-ratio: 40 / 21;
}
</style>
