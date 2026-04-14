<script lang="ts" setup>
import { defineOgImage, useSeoMeta } from '#imports'

useSeoMeta({
  title: 'SPA Nav Page B',
  description: 'Second page for SPA navigation test',
})

defineOgImage('NuxtSeo.satori', { title: 'Page B' })
</script>

<template>
  <div>
    <h1>Page B</h1>
    <NuxtLink id="to-a" to="/satori/spa-nav-a">
      Go to Page A
    </NuxtLink>
  </div>
</template>
