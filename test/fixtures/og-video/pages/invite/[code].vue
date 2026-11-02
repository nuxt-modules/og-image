<script setup lang="ts">
import { defineOgImage, useRoute, useSeoMeta } from '#imports'

const code = String(useRoute().params.code)

useSeoMeta({ title: `Join Beaver · Invite code: ${code}` })

defineOgImage('Invite.takumi', { code }, { video: { durationMs: 2000, fps: 30 } })
</script>

<template>
  <h1>Invite {{ code }}</h1>
</template>
