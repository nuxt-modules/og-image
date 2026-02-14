<script setup lang="ts">
withDefaults(defineProps<{
  title?: string
}>(), {
  title: 'Takumi Variable Bold',
})
</script>

<template>
  <div class="h-full w-full flex flex-col justify-center items-center bg-violet-50 font-variable">
    <h1 class="text-8xl font-bold text-violet-700">
      {{ title }}
    </h1>
    <p class="text-3xl text-violet-400 mt-4">
      This should be regular weight
    </p>
  </div>
</template>
