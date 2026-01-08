<script lang="ts" setup>
import { defineOgImageComponent, ref } from '#imports'

const title = ref('foo')
defineOgImageComponent('NuxtSeo', {
  title,
})
title.value = 'bar'
</script>

<template>
  <div>
    <div>
      bad usage example
    </div>
  </div>
</template>
