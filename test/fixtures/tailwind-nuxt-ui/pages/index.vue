<script setup lang="ts">
import { defineOgImage } from '#imports'

defineOgImage('NuxtUiTest', { title: 'Nuxt UI Colors' })
</script>

<template>
  <div class="min-h-screen bg-default p-8">
    <h1 class="text-4xl font-bold text-primary mb-4">
      Nuxt UI + OG Image Test
    </h1>
    <p class="text-secondary mb-8">
      Testing TW4 theme color transforms for OG images
    </p>
    <UButton color="primary">
      Primary Button
    </UButton>
  </div>
</template>
