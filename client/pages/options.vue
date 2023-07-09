<script lang="ts" setup>
import { highlight } from '#imports'
import { options } from '../util/logic'
</script>

<template>
  <pre of-auto h-full text-sm style="white-space: break-spaces;" v-html="highlight(JSON.stringify(options, null, 2), 'json')" />
</template>
