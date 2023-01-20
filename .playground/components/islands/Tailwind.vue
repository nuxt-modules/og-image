<script setup lang="ts">
const props = defineProps({
  path: String,
  title: String,
  description: String,
})
</script>

<template>
<div class="w-full h-full flex text-white bg-blue-500 items-center justify-center">
  <h1 :style="{ fontSize: '70px' }">{{ title }}</h1>
</div>
</template>
