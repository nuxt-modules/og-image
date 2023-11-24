<script setup>
import { computed, definePageMeta, useServerSeoMeta } from '#imports'

definePageMeta({
  title: 'Home',
  description: 'This is the home page',
  breadcrumbTitle: 'Home',
})

useServerSeoMeta({
  title: 'Welcome to the playground',
  ogTitle: 'Welcome to the playground',
})

const host = computed(() => typeof window !== 'undefined' ? window.location.href : '/')
</script>

<template>
  <div class="px-7 my-5">
    <OgImage description="My description of the home page." />
    <img :src="`${host}__og-image__/image/satori/static/og.png`" width="400" height="210" class="rounded">
  </div>
</template>
