<script lang="ts" setup>
defineOgImage({
  component: 'Default',
  props: {
    title: 'Cloudflare Takumi Test',
  },
})
</script>

<template>
  <div>
    <h1>Cloudflare Takumi Edge Runtime Test</h1>
    <p>Testing takumi renderer with WASM bindings on cloudflare-pages preset</p>
  </div>
</template>
