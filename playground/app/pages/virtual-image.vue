<script setup>
useServerSeoMeta({
  title: 'Welcome to the playground',
  ogTitle: 'Welcome to the playground',
})

defineOgImage('NuxtSeo', {
  theme: '#fcfcfc',
  colorMode: 'dark',
  siteLogo: '/my-img.png',
})
</script>

<template>
  <div>
    <UPageHeader title="Virtual Image" description="OG image with virtual site logo." />
  </div>
</template>
