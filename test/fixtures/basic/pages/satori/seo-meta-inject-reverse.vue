<script lang="ts" setup>
import { defineOgImage, useSeoMeta } from '#imports'

// defineOgImage called BEFORE useSeoMeta - should still pick up title/description
defineOgImage('NuxtSeo.satori')

useSeoMeta({
  title: 'Reverse Order Title',
  description: 'Reverse order description',
})
</script>

<template>
  <div>
    SEO Meta Inject Reverse Order Test
  </div>
</template>
