<script setup>
useServerSeoMeta({
  description: 'page description',
  title: 'Welcome to the playground',
  ogDescription: 'This is an og:image description for the multiple page for whatsapp preview.',
  ogTitle: 'Welcome to the playground',
})

defineOgImage('NuxtSeo', {
  theme: '#fcfcfc',
  colorMode: 'dark',
  siteLogo: '/my-img.png',
})

defineOgImage('NuxtSeo', {
  title: 'Square Image',
  theme: '#fcfcfc',
  colorMode: 'dark',
  siteLogo: '/my-img.png',
}, {
  key: 'square',
  width: 450,
  height: 450,
})
</script>

<template>
  <div>
    <UPageHeader title="Multiple OG Images" description="Page with two defineOgImage calls: default and square." />
  </div>
</template>
