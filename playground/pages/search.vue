<script lang="ts" setup>
import { defineOgImageComponent, useRoute } from '#imports'

const route = useRoute()
defineOgImageComponent('NuxtSeo', {
  title: String(route.query?.q) || 'no title',
})
</script>

<template>
  <div class="px-7 my-5">
    search: {{ route.query?.q }}
  </div>
</template>
