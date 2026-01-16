<script setup lang="ts">
defineProps<{ title?: string }>()
</script>

<template>
  <div class="w-full h-full flex items-center justify-center bg-green-500 text-white">
    <h1 class="text-6xl font-bold">
      {{ title || 'Takumi Template' }}
    </h1>
  </div>
</template>
