<script lang="ts" setup>
import { defineOgImage, useSeoMeta } from '#imports'

useSeoMeta({
  title: 'SPA Nav Page A',
  description: 'First page for SPA navigation test',
})

defineOgImage('NuxtSeo.satori', { title: 'Page A' })
</script>

<template>
  <div>
    <h1>Page A</h1>
    <NuxtLink id="to-b" to="/satori/spa-nav-b">
      Go to Page B
    </NuxtLink>
    <NuxtLink id="to-b-lang-fr" to="/satori/spa-nav-b?lang=fr">
      Go to Page B (lang=fr)
    </NuxtLink>
  </div>
</template>
