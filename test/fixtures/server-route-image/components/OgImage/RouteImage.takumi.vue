<script setup lang="ts">
// A bound src skips Vue's asset URL transform, which would import a static path at build time.
const src = '/route-image.png'
</script>

<template>
  <div style="display: flex; width: 100%; height: 100%; background: white;">
    <img :src="src" width="1200" height="600">
  </div>
</template>
