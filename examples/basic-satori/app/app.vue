<script lang="ts" setup>
defineOgImage('Custom', {
  title: 'My Custom OG Image',
  description: 'Built with nuxt-og-image and satori',
})
</script>

<template>
  <div>
    <h1>Basic Satori Example</h1>
    <p>
      This example uses a custom <code>.satori.vue</code> component
      to generate OG images.
    </p>
    <p>
      View your OG image at <a href="/__og-image__/image/og.png">/__og-image__/image/og.png</a>
    </p>
  </div>
</template>
