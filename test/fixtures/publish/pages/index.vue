<script setup lang="ts">
import { defineOgImage, useSeoMeta } from '#imports'

useSeoMeta({ title: 'Published image' })
defineOgImage('Publish', { title: 'Published image' })
</script>

<template>
  <div>Published image</div>
</template>
