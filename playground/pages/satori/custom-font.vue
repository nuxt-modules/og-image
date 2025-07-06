<script setup lang="ts">
import { defineOgImage } from '#imports'

// Note: Custom fonts should now be configured in nuxt.config.ts
// under the fonts module configuration
defineOgImage({
  component: 'CustomFont',
  props: {
    title: 'Custom Font',
    description: 'Using a custom font configured through @nuxt/fonts',
  },
})
</script>

<template>
  <div>
    <div>
      Custom font page
    </div>
  </div>
</template>
