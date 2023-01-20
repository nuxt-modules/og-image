<script setup lang="ts">
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
  <OgImageStatic component="OgImageWithImage" title="Image Example" :description="description" />
</div>
</template>
