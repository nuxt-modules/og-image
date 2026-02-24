<script setup lang="ts">
withDefaults(defineProps<{
  title?: string
  description?: string
}>(), {
  title: 'चरन् वै मधु विन्दति',
  description: 'Devanagari font fallback test',
})
</script>

<template>
  <div class="h-full w-full flex flex-col justify-center items-center bg-amber-50 font-devanagari">
    <h1 class="text-7xl text-amber-700 font-bold">
      {{ title }}
    </h1>
    <p class="text-3xl text-amber-500 mt-4 font-display">
      {{ description }}
    </p>
  </div>
</template>
