<script lang="ts" setup>
// Multiple OG images using array syntax
defineOgImage([
  // Twitter: 2:1 ratio (1200x600)
  {
    key: 'twitter',
    width: 1200,
    height: 600,
    component: 'NuxtSeo',
    props: { title: 'Twitter Card' },
  },
  // WhatsApp: 1:1 ratio (800x800)
  {
    key: 'whatsapp',
    width: 800,
    height: 800,
    component: 'NuxtSeo',
    props: { title: 'WhatsApp Preview' },
  },
])
</script>

<template>
  <div>
    <h1>Multiple OG Images Test</h1>
  </div>
</template>
