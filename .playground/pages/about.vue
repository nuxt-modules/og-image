<script setup lang="ts">
definePageMeta({
  title: 'About',
  description: 'My description',
  image: 'https://example.com/image.jpg',
})

defineOgImage({
  component: 'OgImage',
  title: 'About',
  description: 'My description',
  customSomething: 'custom',
})
</script>
<template>
  <div>
    About page
  </div>
</template>
