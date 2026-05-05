<script setup lang="ts">
defineProps<{ colorMode?: 'dark' | 'light' }>()
</script>

<template>
  <div :data-theme="colorMode" class="w-full h-full flex items-center justify-center bg-default">
    <div class="bg-inverted text-inverted p-10 text-4xl rounded-lg">
      inverted: {{ colorMode }}
    </div>
  </div>
</template>
