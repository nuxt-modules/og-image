<script setup lang="ts">
definePageMeta({
  title: 'Dynamic Banner',
  description: 'My description',
  image: 'https://example.com/image.jpg',
})

const description = 'This is a description of the page. It can be a bit longer than the title.'
const title = useState('og-image-time-title', () => `The time is: ${Date.now()}`)
</script>

<template>
  <div>
    <div>
      Dynamic Banner page
    </div>
    <OgImageWithoutCache data-allow-mismatch="attribute" :title="title" :description="description" icon="carbon:alarm" />
  </div>
</template>
