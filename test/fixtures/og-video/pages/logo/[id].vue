<script setup lang="ts">
import { defineOgImage, useRoute } from '#imports'

const label = String(useRoute().params.id)

defineOgImage('Logo.takumi', { label }, { video: { durationMs: 1000, fps: 10 } })
</script>

<template>
  <h1>Logo {{ label }}</h1>
</template>
