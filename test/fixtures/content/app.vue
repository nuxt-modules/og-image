<script lang="ts" setup>
defineOgImage({
  props: {
    title: 'hello world',
    foo: 'bar',
    colorMode: 'dark',
    theme: '#121212',
  },
})
</script>

<template>
  <main>
    <ContentDoc />
  </main>
</template>
