<script lang="ts" setup>
import { defineOgImage, useSeoMeta } from '#imports'

defineOgImage({
  url: 'https://nitro.build/_og/_index.png?name=Nitro&title=Next+Generation+Server+Toolkit&description=Create+web+servers+with+everything+you+need+and+deploy+them+wherever+you+prefer.',
  width: 1200,
  height: 630,
  alt: 'Nitro UI',
})

useSeoMeta({
  title: 'Nitro UI',
  ogTitle: 'Nitro UI',
  description: 'Next Generation Server Toolkit',
  ogDescription: 'Create web servers with everything you need and deploy them wherever you prefer.',
})
</script>

<template>
  <div>prebuilt</div>
</template>
