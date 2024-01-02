<script lang="ts" setup>
import { queryContent, useAsyncData, useContentHead, useRoute } from '#imports'

const route = useRoute()

const path = route.path.replace('/content', '')
const { data: page } = await useAsyncData(`docs-${path}`, () => queryContent(path).findOne())
if (!page.value)
  throw createError({ statusCode: 404, statusMessage: 'Page not found' })

// console.log(page.value)
useContentHead(page.value)
</script>

<template>
  <div>
    {{ page }}
  </div>
</template>
