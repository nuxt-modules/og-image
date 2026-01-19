<script lang="ts" setup>
import type { NuxtError } from '#app'

const props = defineProps<{
  error: NuxtError
}>()

defineOgImage('NuxtSeo', {
  title: props.error.statusCode.toString(),
  description: props.error.statusMessage,
  theme: '#fcfcfc',
  colorMode: 'dark',
})
</script>

<template>
  <p>{{ error.statusCode }} - {{ error.statusMessage }}</p>
</template>
