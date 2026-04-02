<script setup lang="ts">
withDefaults(defineProps<{
  title?: string
}>(), {
  title: 'Font Black Weight',
})
</script>

<template>
  <div class="h-full w-full flex flex-col justify-center items-center bg-amber-50" style="font-family: 'Public Sans', sans-serif;">
    <h1 class="text-8xl font-black text-amber-900">
      {{ title }}
    </h1>
    <p class="text-3xl font-medium text-amber-600 mt-4">
      This should be medium weight (500)
    </p>
    <p class="text-2xl text-amber-400 mt-2">
      This should be regular weight (400)
    </p>
  </div>
</template>
