<script setup lang="ts">
import { defineOgImage } from '#imports'

defineOgImage('OgImageDefault', {
  title: 'WOFF2 Conversion Test',
  description: 'Testing that WOFF2 fonts are converted to TTF for Satori',
})
</script>

<template>
  <div>
    <h1>WOFF2 to TTF Conversion Test</h1>
    <p>This page tests that WOFF2 fonts from @nuxt/fonts are converted to TTF for Satori rendering.</p>
  </div>
</template>
