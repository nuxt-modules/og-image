<script setup lang="ts">
withDefaults(defineProps<{
  title?: string
}>(), {
  title: 'Hello World',
})
</script>

<template>
  <div class="w-full h-full flex items-center justify-center bg-gray-900 text-white">
    <div class="flex flex-col items-center gap-4">
      <h1 class="text-6xl font-bold">
        {{ title }}
      </h1>
    </div>
  </div>
</template>
