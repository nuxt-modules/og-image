<script setup lang="ts">
import { useRoute, useSeoMeta } from '#imports'
import { defineOgImage } from '#og-image/app'

useSeoMeta({
  title: 'Nuxt 5 OG Image fixture',
  description: 'Nuxt 5 image rendering check.',
  ogTitle: 'Nuxt 5 OG Image fixture',
  ogDescription: 'Nuxt 5 image rendering check.',
})

defineOgImage(useRoute().query.renderer === 'satori' ? 'DefaultSatori' : 'DefaultTakumi', {
  title: 'Nuxt 5 runtime compatibility',
})
</script>

<template>
  <main>Nuxt 5 OG Image fixture</main>
</template>
