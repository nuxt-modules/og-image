<script setup lang="ts">
import { defineOgImage } from '#imports'

// Satori cannot read WOFF2, so a WOFF2 file passed to defineOgImage must not reach it.
defineOgImage('OgImageDefault', {
  title: 'Defined WOFF2 font',
  renderer: 'satori',
}, { fonts: [
  {
    name: 'Defined WOFF2',
    weight: 400,
    path: '/fonts/noto-sans-sc-100-400-normal.woff2',
  },
] })
</script>

<template>
  <div>Defined WOFF2 font</div>
</template>
