<script setup lang="ts">
import { defineOgImage } from '#imports'

defineOgImage('OgImageDefault', {
  title: 'Nuxt Fonts Conversion Test',
  description: 'Testing that exact WOFF2 assets are converted to WOFF for Satori',
})
</script>

<template>
  <div>
    <h1>Nuxt Fonts WOFF2 Conversion Test</h1>
    <p>This page tests that WOFF2 fonts from @nuxt/fonts are converted to WOFF for Satori rendering.</p>
  </div>
</template>
