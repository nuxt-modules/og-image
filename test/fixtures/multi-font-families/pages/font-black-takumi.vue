<script setup lang="ts">
import { defineOgImage } from '#imports'

defineOgImage('FontBlackCard', {
  renderer: 'takumi',
  title: 'Font Black Weight',
})
</script>

<template>
  <div class="min-h-screen p-8">
    <h1 class="text-4xl font-black">
      Font Black Weight Test (Takumi, 900)
    </h1>
  </div>
</template>
