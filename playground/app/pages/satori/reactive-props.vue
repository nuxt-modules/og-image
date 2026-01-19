<script lang="ts" setup>
import { ref } from '#imports'

const title = ref('foo')
defineOgImage('NuxtSeo', {
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
