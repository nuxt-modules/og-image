<script setup lang="ts">
import { defineOgImage } from '#imports'

defineOgImage('CjkSubsetCard', {
  title: '帖的新日月点网',
  description: 'CJK unicode-range subset fallback test',
})
</script>

<template>
  <div class="min-h-screen p-8">
    <h1 class="text-4xl font-bold">
      CJK Subset Font Fallback Test
    </h1>
  </div>
</template>
