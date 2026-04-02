<script setup lang="ts">
import { defineOgImage } from '#imports'

defineOgImage('FontBlackCard', {
  title: 'Font Black Weight',
})
</script>

<template>
  <div class="min-h-screen p-8">
    <h1 class="text-4xl font-black">
      Font Black Weight Test (900)
    </h1>
    <p class="mt-4 text-lg text-gray-600">
      Tests that font-black (weight 900) renders correctly in satori.
    </p>
  </div>
</template>
