<script lang="ts" setup>
import { defineOgImage, ref } from '#imports'

const name = ref('foo')

defineOgImage({
  url: () => `https://nitro.build/_og/guide/tasks.png?name=${name.value}&title=Tasks&description=Nitro+tasks+allow+on-off+operations+in+runtime.`,
  width: 1200,
  height: 630,
  alt: 'Nitro UI',
})

name.value = 'bar'
</script>

<template>
  <div>prebuilt</div>
</template>
