<script lang="ts" setup>
import { computed, defineOgImage, ref } from '#imports'

const title = ref('Hello World')
const description = computed(() => `Description: ${title.value}`)

defineOgImage('NuxtSeo', {
  title,
  description,
})
</script>

<template>
  <div>
    Computed Test
  </div>
</template>
