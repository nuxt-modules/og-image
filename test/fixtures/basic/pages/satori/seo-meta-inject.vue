<script lang="ts" setup>
import { defineOgImage, useSeoMeta } from '#imports'

useSeoMeta({
  title: 'Auto Injected Title',
  description: 'Auto injected description from useSeoMeta',
})

// No explicit title/description props - should be auto-injected from useSeoMeta
defineOgImage('NuxtSeo.satori')
</script>

<template>
  <div>
    SEO Meta Inject Test
  </div>
</template>
