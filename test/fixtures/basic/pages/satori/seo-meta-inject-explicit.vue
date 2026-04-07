<script lang="ts" setup>
import { defineOgImage, useSeoMeta } from '#imports'

useSeoMeta({
  title: 'SEO Title',
  description: 'SEO description',
})

// Explicit props should win over useSeoMeta values
defineOgImage('NuxtSeo.satori', {
  title: 'Explicit Title',
  description: 'Explicit description',
})
</script>

<template>
  <div>
    SEO Meta Inject Explicit Props Test
  </div>
</template>
