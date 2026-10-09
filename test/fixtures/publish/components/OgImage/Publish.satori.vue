<script setup lang="ts">
defineProps<{ title: string }>()
</script>

<template>
  <div style="display: flex; width: 100%; height: 100%; background: white; color: black; font-size: 64px;">
    {{ title }}
  </div>
</template>
