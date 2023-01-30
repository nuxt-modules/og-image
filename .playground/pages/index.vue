<script setup>
definePageMeta({
  title: 'Home',
  description: 'This is the home page',
  breadcrumbTitle: 'Home'
})

useHead({
  title: 'Home',
})

const host = computed(() => typeof window !== 'undefined' ? window.location.href : '/')
</script>
<template>
<div class="px-7 my-5">
  <OgImageStatic description="My description of the home page." theme-color="#b5ffd6" />
  <div class="mb-10 xl:grid grid-cols-2 gap-10 justify-center">
    <div>
      <h2 class="text-lg font-bold mb-3">Browser Screenshot</h2>
      <div class="lg:grid grid-cols-2 gap-5">
        <div>
          <NuxtLink external no-prefetch to="/browser/custom" target="_blank">
            <div class="mb-2">Page</div>
            <img :src="`${host}browser/custom/__og_image__/og.png`" width="400" height="210" class="rounded" />
          </NuxtLink>
        </div>
        <div>
          <NuxtLink external no-prefetch to="/browser/component" target="_blank">
            <div class="mb-2">Vue Component</div>
            <img :src="`${host}browser/component/__og_image__/og.png`" width="400" height="210" class="rounded" />
          </NuxtLink>
        </div>
      </div>
    </div>
    <div>
      <h2 class="text-lg font-bold mb-3">Satori</h2>
      <div class="lg:grid grid-cols-2 gap-5">
        <NuxtLink external no-prefetch to="/satori/static/__og_image__/" target="_blank">
          <div class="mb-2">Static</div>
          <img :src="`${host}satori/static/__og_image__/og.png`" width="400" height="210" class="rounded" />
        </NuxtLink>
        <NuxtLink external no-prefetch to="/satori/dynamic/__og_image__/" target="_blank">
          <div class="mb-2">Dynamic</div>
          <img :src="`${host}satori/dynamic/__og_image__/og.png`" width="400" height="210" class="rounded" />
        </NuxtLink>
        <NuxtLink external no-prefetch to="/satori/image/__og_image__/" target="_blank">
          <div class="mb-2">Image</div>
          <img :src="`${host}satori/image/__og_image__/og.png`" width="400" height="210" class="rounded" />
        </NuxtLink>
        <NuxtLink external no-prefetch to="/satori/tailwind/__og_image__/" target="_blank">
          <div class="mb-2">Tailwind</div>
          <img :src="`${host}satori/tailwind/__og_image__/og.png`" width="400" height="210" class="rounded" />
        </NuxtLink>
      </div>
    </div>
  </div>
</div>
</template>
