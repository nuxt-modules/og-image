<script setup lang="ts">
const data = await $fetch<{ hello: string }>('/api/hello')
</script>

<template>
  <div>
    <span data-hello>{{ data.hello }}</span>
    <NuxtIsland name="HelloIsland" />
  </div>
</template>
