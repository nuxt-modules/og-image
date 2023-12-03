<script lang="ts" setup>
import { defineOgImage, useHead, useSeoMeta } from '#imports'

useHead({
  title: 'Hello World',
  titleTemplate: '%s %separator %siteName',
  templateParams: {
    separator: '-',
    siteName: 'Harlan Wilton',
  },
})
useSeoMeta({
  // write 300 characters
  description: 'This is a description of the page. It can be a bit longer than the title.',
})

defineOgImage({
  test: '123',
  theme: 'light',
  colorMode: 'dark',
})
</script>

<template>
  <div>
    <div>
      Default example with options
    </div>
  </div>
</template>
