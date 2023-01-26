<script lang="ts" setup>
const vnodes = await fetchVNodes()
</script>

<template>
  <pre of-auto h-full text-sm style="white-space: break-spaces;" v-html="highlight(JSON.stringify(vnodes, null, 2), 'json')" />
</template>
