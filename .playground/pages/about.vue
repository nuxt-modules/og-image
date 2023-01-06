<script setup lang="ts">
import {defineOgImageScreenshot} from "#imports";

definePageMeta({
  title: 'About',
  description: 'My description',
  image: 'https://example.com/image.jpg',
})
</script>
<template>
  <div class="about-page">
    <div>
      About page
    </div>
    <OgImage component="OgImageTemplate" title="About" description="My Description" random-data="test" />
  </div>
</template>
