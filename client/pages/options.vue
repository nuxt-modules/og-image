<script lang="ts" setup>
import { options } from '../util/logic'
import { highlight } from '#imports'
</script>

<template>
  <pre of-auto h-full text-sm style="white-space: break-spaces;" v-html="highlight(JSON.stringify(options, null, 2), 'json')" />
</template>
