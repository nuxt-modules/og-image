<script lang="ts" setup>
import type { NuxtError } from '#app'
import { defineOgImageComponent } from '#imports'

const props = defineProps<{
  error: NuxtError
}>()

defineOgImageComponent('NuxtSeo', {
  title: props.error.statusCode.toString(),
  description: props.error.statusMessage,
  theme: '#fcfcfc',
  colorMode: 'dark',
})
</script>

<template>
  <p>{{ error.statusCode }} - {{ error.statusMessage }}</p>
</template>
