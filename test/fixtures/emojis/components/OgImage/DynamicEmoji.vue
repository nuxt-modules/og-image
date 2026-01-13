<script setup lang="ts">
defineProps<{
  emoji: string
  title: string
}>()
</script>

<template>
  <div class="w-full h-full flex flex-col items-center justify-center bg-white p-8">
    <div class="text-6xl mb-6">
      {{ emoji }}
    </div>
    <h1 class="text-xl font-bold">
      {{ title }}
    </h1>
    <p class="text-sm text-gray-600">
      Dynamic emoji passed via props - handled at runtime
    </p>
  </div>
</template>
