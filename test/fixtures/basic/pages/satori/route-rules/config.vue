<script lang="ts" setup>
// nothing to see here, defined in global route rules
import { defineRouteRules } from '#imports'

defineOgImageComponent('NuxtSeo', {
  theme: '#c3f2b4',
})

defineRouteRules({
  ogImage: {
    description: 'This is coming from inline route rules',
  },
})
</script>

<template>
  <div>
    <h1>Hello route rules</h1>
  </div>
</template>
