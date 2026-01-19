<script setup lang="ts">
import { definePageMeta, useSeoMeta } from '#imports'

definePageMeta({
  title: 'Static Banner',
  description: 'My description',
  image: 'https://example.com/image.jpg',
})

const description = 'This is a description of the page. It can be a bit longer than the title.'
useSeoMeta({
  description,
})
</script>

<template>
  <div>
    <div>
      Static Banner page
    </div>
    <OgImage title="Static Banner" />
  </div>
</template>
