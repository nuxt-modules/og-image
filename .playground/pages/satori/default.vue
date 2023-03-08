<script lang="ts" setup>
useHead({
  title: 'Hello World',
  titleTemplate: '%s %separator %siteName',
  templateParams: {
    separator: '-',
    siteName: 'Harlan Wilton'
  }
})
</script>
<template>
  <div>
    <div>
      Default example with options
    </div>
    <OgImageStatic />
  </div>
  </template>
