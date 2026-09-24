<script setup lang="ts">
withDefaults(defineProps<{ title?: string }>(), { title: 'title' })
</script>

<template>
  <div style="display: flex; width: 100%; height: 100%; background: #111; color: white; font-size: 80px; padding: 60px">
    {{ title }}
  </div>
</template>
