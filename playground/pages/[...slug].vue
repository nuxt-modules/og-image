<script lang="ts" setup>
import { defineOgImageComponent } from '#imports'

defineOgImageComponent('NuxtSeo', {
  title: 'Welcome to the Nuxt.js Playground',
  description: 'A place to play with Nuxt.js and its ecosystem',
  image: 'https://play.nuxtjs.org/og-image.png',
})
</script>

<template>
  <nav>
    <ul>
      <li>
        <NuxtLink to="/">
          Welcome
        </NuxtLink>
      </li>
      <li>
        <NuxtLink to="/custom">
          Custom Component
        </NuxtLink>
      </li>
    </ul>
  </nav>
</template>
