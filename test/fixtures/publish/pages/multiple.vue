<script setup lang="ts">
import { defineOgImage } from '#imports'

defineOgImage('Publish', { title: 'First image' })
defineOgImage('Publish', { title: 'Second image' }, { key: 'second' })
</script>

<template>
  <div>Multiple images</div>
</template>
