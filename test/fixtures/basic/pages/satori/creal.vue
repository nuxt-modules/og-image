<script lang="ts" setup>
defineOgImage({
  component: 'Creal',
  props: {
    title: 'Test Page',
    siteConfigName: 'cReal',
    headline: 'Adelaide DJ',
    name: 'DJ cReal',
  },
})
</script>

<template>
  <div>
    <h1>Creal OG Image Test</h1>
    <p>Visit <code>/__og-image__/image/satori/creal/og.png</code> to see the OG image</p>
  </div>
</template>
