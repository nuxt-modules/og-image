<script setup lang="ts">
withDefaults(defineProps<{
  title?: string
  description?: string
}>(), {
  title: 'Inline Font Test',
  description: 'Testing font-family via inline style',
})
</script>

<template>
  <div class="w-full h-full flex flex-col justify-center items-center bg-blue-500 text-white p-12">
    <h1
      class="text-6xl font-bold mb-4"
      style="font-family: 'Inter', sans-serif;"
    >
      {{ title }}
    </h1>
    <p
      class="text-2xl"
      style="font-family: 'Roboto', sans-serif;"
    >
      {{ description }}
    </p>
  </div>
</template>
