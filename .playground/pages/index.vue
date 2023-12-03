<script setup>
import { definePageMeta, useServerSeoMeta } from '#imports'

definePageMeta({
  title: 'Home',
  description: 'This is the home page',
  breadcrumbTitle: 'Home',
})

useServerSeoMeta({
  title: 'Welcome to the playground',
  ogTitle: 'Welcome to the playground',
})

// defineOgImageComponent('Nuxt', {
//   headline: 'Nuxt OG Image',
//   title: 'Version 3 🎉',
//   description: 'Nuxt OG Image v3 is here!',
// })
</script>

<template>
  <div class="px-7 my-5">
    <div>
      <ul>
        <li>
          <a target="_blank" href="/__og-image__/image/chromium/og.jpeg">Chromium default</a>
        </li>
        <li>
          <a target="_blank" href="/__og-image__/image/chromium/og.png">Chromium png</a>
        </li>
      </ul>
      <ul>
        <li>
          <NuxtLink href="/satori/">
            Satori index
          </NuxtLink>
        </li>
        <li>
          <a target="_blank" href="/__og-image__/image/satori/og.png">Satori png</a>
        </li>
      </ul>
    </div>
  </div>
</template>
