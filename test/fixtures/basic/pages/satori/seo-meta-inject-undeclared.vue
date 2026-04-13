<script lang="ts" setup>
import { defineOgImage, useHead } from '#imports'

useHead({ title: '1' })

// PropTest only declares a `logo` prop — title from useHead must NOT be auto-injected
defineOgImage('PropTest')
</script>

<template>
  <div>
    SEO Meta Inject Undeclared Test
  </div>
</template>
