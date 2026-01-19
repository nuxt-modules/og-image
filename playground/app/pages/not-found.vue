<script lang="ts" setup>
import { createError } from '#imports'

throw createError({
  statusCode: 404,
  statusMessage: 'Not found',
})
</script>

<template>
  <p>not found page</p>
</template>
