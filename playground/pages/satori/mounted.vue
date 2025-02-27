<script lang="ts" setup>
import { defineOgImageComponent, onMounted } from '#imports'

onMounted(() => {
  defineOgImageComponent('NuxtSeo', {
    title: 'test',
  })
})
</script>

<template>
  <div>
    <div>
      bad usage example
    </div>
  </div>
</template>
