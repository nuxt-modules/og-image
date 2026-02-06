<script setup lang="ts">
withDefaults(defineProps<{
  title?: string
}>(), {
  title: 'Lobster Script',
})
</script>

<template>
  <div class="h-full w-full flex flex-col justify-center items-center bg-rose-50 font-display">
    <h1 class="text-8xl text-rose-600">
      {{ title }}
    </h1>
    <p class="text-3xl text-rose-400 mt-4">
      Cursive display font
    </p>
  </div>
</template>
