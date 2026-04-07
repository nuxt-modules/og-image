<script setup lang="ts">
withDefaults(defineProps<{
  title?: string
  description?: string
}>(), {
  title: '帖的新日月点网',
  description: 'CJK unicode-range subset fallback test',
})
</script>

<template>
  <div class="h-full w-full flex flex-col justify-center items-center bg-red-50 font-cjk">
    <h1 class="text-7xl text-red-700">
      {{ title }}
    </h1>
    <p class="text-3xl text-red-400 mt-4">
      {{ description }}
    </p>
  </div>
</template>
