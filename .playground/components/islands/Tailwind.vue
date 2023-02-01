<script setup lang="ts">
const props = defineProps({
  path: String,
  title: String,
  description: String,
  bgColor: String,
})

const isClass = computed(() => props.bgColor?.startsWith('bg-'))
</script>

<template>
<div class="w-full h-full flex text-white items-center justify-center" :class="isClass ? [bgColor || 'bg-blue-500'] : []" :style="{ backgroundColor: !isClass ? `#${bgColor}` : undefined }">
  <h1 :style="{ fontSize: '70px' }">{{ title }}</h1>
</div>
</template>
