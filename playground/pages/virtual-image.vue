<script setup>
import { defineOgImageComponent, definePageMeta, useServerSeoMeta } from '#imports'

definePageMeta({
  title: 'Home',
  description: 'This is the home page',
  breadcrumbTitle: 'Home',
})

useServerSeoMeta({
  title: 'Welcome to the playground',
  ogTitle: 'Welcome to the playground',
})

defineOgImageComponent('NuxtSeo', {
  theme: '#fcfcfc',
  colorMode: 'dark',
  siteLogo: '/my-img.png',
})
</script>

<template>
  <div class="px-7 my-5">
    <div>
      <ul>
        <li>
          <NuxtLink href="/chromium/screenshot">
            Chromium screenshot
          </NuxtLink>
        </li>
        <li>
          <NuxtLink href="/chromium/component">
            Chromium component
          </NuxtLink>
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
        <li>
          <NuxtLink to="/satori/image">
            Satori image
          </NuxtLink>
        </li>
      </ul>
    </div>
  </div>
</template>
