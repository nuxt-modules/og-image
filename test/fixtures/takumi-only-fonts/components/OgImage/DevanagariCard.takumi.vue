<script setup lang="ts">
withDefaults(defineProps<{
  title?: string
  description?: string
}>(), {
  title: 'चरन् वै मधु विन्दति',
  description: 'Takumi-only devanagari rendering',
})
</script>

<template>
  <div class="h-full w-full flex flex-col justify-center items-center bg-white">
    <h1 class="text-6xl text-rose-600 font-bold" style="font-family: 'Noto Sans Devanagari', sans-serif;">
      {{ title }}
    </h1>
    <p class="text-2xl text-gray-500 mt-4" style="font-family: 'Poppins', sans-serif;">
      {{ description }}
    </p>
  </div>
</template>
