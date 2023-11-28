<script lang="ts" setup>
import { useHead, useLocaleHead, useNuxtApp } from '#imports'

const i18n = useNuxtApp().$i18n

const i18nHead = useLocaleHead({
  addDirAttribute: true,
  identifierAttribute: 'id',
  addSeoAttributes: true,
  i18n,
})

useHead({
  htmlAttrs: {
    lang: i18nHead.value.htmlAttrs!.lang,
  },
  link: [...(i18nHead.value.link || [])],
  meta: [...(i18nHead.value.meta || [])],
})
</script>

<template>
  <div>{{ $route.params.page }}</div>
</template>
