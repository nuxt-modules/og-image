<script setup lang="ts">
withDefaults(defineProps<{
  title?: string
  description?: string
}>(), {
  title: 'Default Title',
  description: 'Default description',
})
</script>

<template>
  <div class="w-full h-full flex flex-col items-center justify-center bg-purple-600 text-white p-16">
    <h1 class="text-5xl font-bold mb-4">
      {{ title }}
    </h1>
    <p v-if="description" class="text-xl opacity-80">
      {{ description }}
    </p>
  </div>
</template>
