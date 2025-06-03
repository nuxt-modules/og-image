<script lang="ts" setup>
import { defineOgImage } from '#imports'

defineOgImage({
  extension: 'jpeg',
  sharp: {
    quality: 10,
    progressive: true,
  },
  props: {
    title: 'This is a long title 😮 that will exceed 60 chars',
    description: 'And perhpas a long description? 😮 Yup, here it is. A max of 100 characters, will see. Guess we can go really long, maybe even 3 lines, will see what happens now.',
  },
})
</script>

<template>
  <div>inline</div>
</template>
