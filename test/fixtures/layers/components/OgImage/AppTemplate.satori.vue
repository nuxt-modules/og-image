<script setup lang="ts">
withDefaults(defineProps<{
  title?: string
}>(), {
  title: 'From App',
})
</script>

<template>
  <div class="w-full h-full flex items-center justify-center bg-green-900 text-white">
    <h1 class="text-6xl font-bold">
      {{ title }}
    </h1>
  </div>
</template>
