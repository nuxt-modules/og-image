<script setup lang="ts">
import { defineOgImage } from '#imports'

defineOgImage('Float.takumi', {}, {
  video: { durationMs: 1000, fps: 10 },
  takumi: {
    timeMs: 500,
    css: [{
      keyframes: 'float',
      steps: [
        { offset: 'from', style: { transform: 'translateY(0px)' } },
        { offset: 'to', style: { transform: 'translateY(-200px)' } },
      ],
    }],
  },
})
</script>

<template>
  <h1>Float</h1>
</template>
