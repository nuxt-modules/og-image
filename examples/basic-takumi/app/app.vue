<script lang="ts" setup>
defineOgImage('Custom', {
  title: 'My Custom OG Image',
  description: 'Built with nuxt-og-image and takumi',
})
</script>

<template>
  <div>
    <h1>Basic Takumi Example</h1>
    <p>
      This example uses a custom <code>.takumi.vue</code> component
      to generate OG images.
    </p>
    <p>
      View your OG image at <a href="/__og-image__/image/og.png">/__og-image__/image/og.png</a>
    </p>
  </div>
</template>
