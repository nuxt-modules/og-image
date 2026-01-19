<script lang="ts" setup>
import { useRoute } from '#imports'

const route = useRoute()
defineOgImage('NuxtSeo', {
  title: String(route.query?.q) || 'no title',
})
</script>

<template>
  <div class="px-7 my-5">
    search: {{ route.query?.q }}
  </div>
</template>
