<script setup>
import { computed, defineOgImageComponent, definePageMeta, useServerSeoMeta } from '#imports'

definePageMeta({
  title: 'Home',
  description: 'This is the home page',
  breadcrumbTitle: 'Home',
})

useServerSeoMeta({
  title: 'Welcome to the playground',
  ogTitle: 'Welcome to the playground',
})

defineOgImageComponent('Nuxt', {
  headline: 'Nuxt OG Image',
  title: 'Version 3 🎉',
  description: 'Nuxt OG Image v3 is here!',
})

const host = computed(() => typeof window !== 'undefined' ? window.location.href : '/')
</script>

<template>
  <div class="px-7 my-5">
    <img :src="`${host}__og-image__/image/satori/static/og.png`" width="400" height="210" class="rounded">
  </div>
</template>
