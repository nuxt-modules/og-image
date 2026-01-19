<script setup lang="ts">
import { defineOgImage } from '#imports'

defineOgImage('CustomFont', {
  title: 'Custom Font',
  description: 'Using a custom font loaded from the public directory',
}, { fonts: [
  {
    name: 'optieinstein',
    weight: 800,
    path: '/OPTIEinstein-Black.otf',
  },
] })
</script>

<template>
  <div>
    <div>
      Custom font page
    </div>
  </div>
</template>
