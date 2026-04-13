<script lang="ts" setup>
import { defineOgImage, useHead } from '#imports'

// useHead (not useSeoMeta) sets a page title — this must NOT leak into the og:image URL (#573).
useHead({ title: '1' })

// NuxtSeo declares a title prop, but since the title comes from useHead (not useSeoMeta),
// it should still NOT be auto-injected.
defineOgImage('NuxtSeo.satori')
</script>

<template>
  <div>
    useHead title leakage test
  </div>
</template>
