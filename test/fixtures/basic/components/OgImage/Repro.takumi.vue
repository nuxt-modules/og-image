<script setup lang="ts">
defineProps<{
  src: string
}>()
</script>

<template>
  <div class="w-full h-full flex items-center justify-center bg-gray-900 text-white">
    <img :src="src" class="w-[224px] h-[40px]">
  </div>
</template>
