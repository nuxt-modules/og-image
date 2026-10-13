<script lang="ts" setup>
import { defineOgImage, useSeoMeta } from '#imports'

defineOgImage('NuxtSeo.satori', { title: 'User Twitter Card' })

useSeoMeta({
  twitterCard: 'summary',
})
</script>

<template>
  <div>
    User twitter:card Test
  </div>
</template>
