<script setup lang="ts">
withDefaults(defineProps<{
  title?: string
}>(), {
  title: 'Playfair Display',
})
</script>

<template>
  <div class="h-full w-full flex flex-col justify-center items-center bg-gray-900 font-serif">
    <h1 class="text-8xl font-bold text-amber-400">
      {{ title }}
    </h1>
    <p class="text-3xl text-gray-300 mt-4">
      Classic serif font
    </p>
  </div>
</template>
