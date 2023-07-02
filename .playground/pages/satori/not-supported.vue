<script setup lang="ts">
definePageMeta({
  title: 'Static Banner',
  description: 'My description',
  image: 'https://example.com/image.jpg',
})

const description = 'It looks like you\'re trying to use the browser provider in a nitro runtime that does not support it. This is a fallback' +
  ' image to tell you that it does not work.You should consider prerendering any routes that use the browser provider or changing runtime.'
</script>
<template>
  <div>
    <div>
      Static Banner page
    </div>
    <OgImage title="Browser provider is not supported." :description="description" />
  </div>
</template>
