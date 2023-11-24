<script setup lang="ts">
import ArrayProp from '~/components/OgImage/ArrayProp.vue'

defineOgImage(ArrayProp, {
  component: 'ArrayProp',
  list: [1, 2, 3],
})
</script>

<template>
  <div>
    <div>
      Default example with options
    </div>
  </div>
</template>
