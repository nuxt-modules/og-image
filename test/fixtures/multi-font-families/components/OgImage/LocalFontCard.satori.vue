<script setup lang="ts">
defineProps<{ title: string }>()
</script>

<template>
  <div class="h-full w-full flex flex-col justify-center items-center bg-emerald-50">
    <h1 class="text-8xl font-bold text-emerald-700 font-local-sans">
      {{ title }}
    </h1>
    <p class="text-3xl text-emerald-400 mt-4 font-local-serif">
      Merriweather serif description
    </p>
  </div>
</template>
