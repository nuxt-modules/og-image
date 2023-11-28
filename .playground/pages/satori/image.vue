<script setup lang="ts">
import { definePageMeta } from '#imports'

definePageMeta({
  title: 'Image Example',
  description: 'My description',
  image: '/image.jpg',
})

const description = 'This is a description of the page. It can be a bit longer than the title.'
</script>

<template>
  <div>
    <div>
      Static Banner page
    </div>
    <OgImage component="Image" title="Image Example" :description="description" />
  </div>
</template>
