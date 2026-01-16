<script setup>
import { definePageMeta, useServerSeoMeta } from '#imports'

definePageMeta({
  title: 'Home',
  description: 'This is the home page',
  breadcrumbTitle: 'Home',
})

useServerSeoMeta({
  title: 'Welcome to the playground',
  description: 'Test description',
  ogTitle: 'Welcome to the playground',
})

defineOgImage('NuxtSeo', {
  theme: '#fcfcfc',
  colorMode: 'dark',
})
</script>

<template>
  <div class="px-7 my-5">
    <div>
      <div class="mb-6 p-4 bg-green-50 rounded-lg border border-green-200">
        <NuxtLink href="/templates" class="text-lg font-semibold text-green-700 hover:text-green-900">
          Template Gallery &rarr;
        </NuxtLink>
        <p class="text-sm text-green-600 mt-1">
          Browse all community OG image templates
        </p>
      </div>
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
          <a target="_blank" href="/_og/d/satori/og.png">Satori png</a>
        </li>
        <li>
          <NuxtLink to="/satori/image">
            Satori image
          </NuxtLink>
        </li>
        <li>
          <NuxtLink to="/multiple">
            Satori Multiple
          </NuxtLink>
        </li>
        <li>
          <NuxtLink to="/satori/mounted">
            Satori onMounted
          </NuxtLink>
        </li>
      </ul>
    </div>
  </div>
</template>
