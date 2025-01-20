<script setup>
import { defineOgImageComponent, definePageMeta, useServerSeoMeta } from '#imports'

definePageMeta({
  title: 'Home',
  description: 'This is the home page',
  breadcrumbTitle: 'Home',
})

useServerSeoMeta({
  description: 'page description',
  title: 'Welcome to the playground',
  ogDescription: 'This is an og:image description for the multiple page for whatsapp preview.',
  ogTitle: 'Welcome to the playground',
})

defineOgImageComponent('NuxtSeo', {
  theme: '#fcfcfc',
  colorMode: 'dark',
  siteLogo: '/my-img.png',
})

defineOgImageComponent('NuxtSeo', {
  title: 'Square Image',
  theme: '#fcfcfc',
  colorMode: 'dark',
  siteLogo: '/my-img.png',
}, {
  key: 2,
  width: 450,
  height: 450,
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
          <a target="_blank" href="/_og/image/satori/og.png">Satori png</a>
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
