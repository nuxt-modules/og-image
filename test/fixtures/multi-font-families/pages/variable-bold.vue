<script setup lang="ts">
import { defineOgImage } from '#imports'

defineOgImage('VariableBoldCard', {
  title: 'Variable Font Bold',
})
</script>

<template>
  <div class="min-h-screen p-8">
    <h1 class="text-4xl font-bold">
      Variable Font Bold Weight Test
    </h1>
    <p class="mt-4 text-lg text-gray-600">
      Tests that variable fonts with weight ranges download the bold weight.
    </p>
  </div>
</template>
