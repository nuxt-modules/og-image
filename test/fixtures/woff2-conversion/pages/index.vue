<script setup lang="ts">
import { defineOgImage } from '#imports'

defineOgImage('OgImageDefault', {
  title: '一丁七万三上下不与',
  description: 'Subsetted Noto Sans SC',
})
</script>

<template>
  <div>
    <h1>Nuxt Fonts WOFF2 Conversion Test</h1>
    <p>This page tests that WOFF2 fonts from @nuxt/fonts are decoded to TTF for Satori rendering.</p>
  </div>
</template>
