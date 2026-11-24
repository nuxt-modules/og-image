<script setup lang="ts">
import { defineOgImage } from '#imports'

const [path] = defineOgImage('Plain.satori', {}, { video: true })
</script>

<template>
  <h1>Satori</h1>
  <p id="og-path">
    {{ path }}
  </p>
</template>
