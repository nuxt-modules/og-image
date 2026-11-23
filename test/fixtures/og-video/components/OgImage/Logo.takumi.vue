<script setup lang="ts">
withDefaults(defineProps<{ label?: string }>(), { label: 'logo' })

// A server route, not a public file, so the render fetches it at runtime.
const logo = '/logo.png'
</script>

<template>
  <div class="h-full w-full flex items-center justify-between bg-black px-24">
    <p class="text-7xl text-white">
      {{ label }}
    </p>
    <img :src="logo" class="w-40 h-40 animate-spin">
  </div>
</template>
