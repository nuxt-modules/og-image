<script setup lang="ts">
withDefaults(defineProps<{ title?: string }>(), { title: 'Default' })
</script>

<template>
  <div class="w-full h-full flex justify-center items-center bg-white">
    <h1 class="text-4xl font-bold">
      {{ title }}
    </h1>
  </div>
</template>
