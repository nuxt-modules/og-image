<script setup lang="ts">
import { defineOgImage } from '#imports'

defineOgImage('InterCard', {
  title: 'Lobster Script',
})
</script>

<template>
  <div class="min-h-screen p-8">
    <h1 class="text-4xl font-bold">
      Multi Font Families Test
    </h1>
    <nav class="mt-4 space-y-2">
      <NuxtLink to="/playfair" class="block text-blue-600">
        Playfair Display Page
      </NuxtLink>
      <NuxtLink to="/roboto" class="block text-blue-600">
        Roboto Page
      </NuxtLink>
    </nav>
  </div>
</template>
