<script lang="ts" setup>
import { defineOgImageCached } from '#imports'

defineOgImageCached({
  title: 'Satori Test',
  description: 'This is a test',
})
</script>

<template>
  <div>
    <img src="/__og_image__/og.png" width="1200" height="630">
  </div>
</template>
