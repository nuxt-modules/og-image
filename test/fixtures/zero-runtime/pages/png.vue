<script lang="ts" setup>
import { defineOgImage } from '#imports'

defineOgImage({
  renderer: 'satori',
  extension: 'png',
  props: {
    title: 'png extension',
  },
})
</script>

<template>
  <div>
    <h1>Hello World</h1>
  </div>
</template>
