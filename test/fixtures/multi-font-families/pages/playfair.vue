<script setup lang="ts">
import { defineOgImage } from '#imports'

defineOgImage('PlayfairCard', {
  title: 'Playfair Display',
})
</script>

<template>
  <div class="min-h-screen p-8">
    <h1 class="text-4xl font-bold">
      Playfair Display Page
    </h1>
    <p class="mt-4 text-lg text-gray-600">
      This page uses Playfair Display for its OG image.
    </p>
  </div>
</template>
