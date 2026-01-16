<script setup lang="ts">
import { defineOgImage } from '#imports'

defineOgImage('CustomFonts', {
  title: 'Custom Font',
  description: 'Using a custom font loaded from the public directory',
}, { fonts: [
  {
    name: 'optieinstein',
    weight: 800,
    path: '/OPTIEinstein-Black.otf',
  },
  'Noto+Sans:400',
] })
</script>

<template>
  <div>
    <div>
      Custom font page
    </div>
  </div>
</template>
