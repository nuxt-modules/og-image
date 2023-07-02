<script setup lang="ts">
definePageMeta({
  title: 'Static Banner',
  description: 'My description',
  image: 'https://example.com/image.jpg',
})

const description = 'This is a description of the page. It can be a bit longer than the title.'
</script>
<template>
  <div>
    <div>
      Static Banner page
    </div>
    <OgImage title="Static Banner" :description="description" width="600" height="600" />
  </div>
</template>
