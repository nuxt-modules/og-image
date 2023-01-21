<script setup lang="ts">
definePageMeta({
  title: 'Dynamic Banner',
  description: 'My description',
  image: 'https://example.com/image.jpg',
})

const description = 'This is a description of the page. It can be a bit longer than the title.'
</script>
<template>
  <div>
    <div>
      Dynamic Banner page
    </div>
    <OgImageDynamic component="BannerTemplate" :title="'The time is: ' + Date.now()" :description="description" />
  </div>
</template>
