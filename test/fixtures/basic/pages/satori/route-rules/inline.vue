<script lang="ts" setup>
import { defineRouteRules } from '#imports'

defineRouteRules({
  ogImage: {
    description: 'This is coming from inline route rules',
    colorMode: 'dark',
  },
})
</script>

<template>
  <div>
    <h1>Hello route rules</h1>
  </div>
</template>
