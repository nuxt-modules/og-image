<script lang="ts" setup>
import { fetchOptions, highlight } from '#imports'

const options = await fetchOptions()
</script>

<template>
  <pre of-auto h-full text-sm style="white-space: break-spaces;" v-html="highlight(JSON.stringify(options, null, 2), 'json')" />
</template>
