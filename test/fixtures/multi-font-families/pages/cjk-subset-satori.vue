<script setup lang="ts">
import { defineOgImage } from '#imports'

defineOgImage('CjkSubsetCard', {
  title: '帖的新日月点网',
  description: 'CJK unicode-range subset fallback (satori)',
  renderer: 'satori',
})
</script>

<template>
  <div class="min-h-screen p-8">
    <h1 class="text-4xl font-bold">
      CJK Subset Font Fallback Test (Satori)
    </h1>
  </div>
</template>
