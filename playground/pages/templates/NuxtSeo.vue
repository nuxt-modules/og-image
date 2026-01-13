<script setup lang="ts">
import { defineOgImageComponent } from '#imports'

defineOgImageComponent('NuxtSeo', {
  title: 'Build Better SEO with Nuxt',
  description: 'The complete SEO solution for Nuxt applications',
  theme: '#00dc82',
  colorMode: 'dark',
})
</script>

<template>
  <div class="p-8">
    <h1 class="text-2xl font-bold mb-4">
      NuxtSeo Template
    </h1>
    <a href="/__og-image__/image/templates/NuxtSeo/og.png" target="_blank" class="text-blue-500 underline">View OG Image</a>
  </div>
</template>
