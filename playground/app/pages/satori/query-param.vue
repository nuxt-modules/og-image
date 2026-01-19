<script lang="ts" setup>
import { defineOgImage, useRoute } from '#imports'

// use query param for dynamic og image
const query = useRoute().query
defineOgImage({
  props: {
    title: query.title || 'test',
  },
})
</script>

<template>
  <div>query param</div>
</template>
