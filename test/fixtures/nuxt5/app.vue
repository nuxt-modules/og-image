<script setup lang="ts">
import { defineOgImage, useRoute } from '#imports'

defineOgImage(useRoute().query.renderer === 'satori' ? 'DefaultSatori' : 'DefaultTakumi', {
  title: 'Nuxt 5 runtime compatibility',
})
</script>

<template>
  <main>Nuxt 5 OG Image fixture</main>
</template>
