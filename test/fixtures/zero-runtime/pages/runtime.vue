<script lang="ts" setup>
// Not prerendered. The call is not at the start of a line on purpose.
const paths = defineOgImage('CustomFonts.satori', {
  title: 'Runtime',
})
</script>

<template>
  <div>
    <h1>Runtime {{ paths.length }}</h1>
  </div>
</template>
