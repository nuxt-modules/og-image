<script setup lang="ts">
import { defineOgImage } from '#imports'

defineOgImage({
  component: 'InlineFont',
  props: {
    title: 'Inline Font Style',
    description: 'Font-family defined in component style attribute',
  },
})
</script>

<template>
  <div>
    <h1>Inline Font Test</h1>
    <p>Tests font-family defined via inline style in OG image component</p>
  </div>
</template>
