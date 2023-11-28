<script setup lang="ts">
import { prerenderRoutes } from '#imports'

prerenderRoutes([
  '/en/dynamic/foo',
  '/en/dynamic/bar',
])

const i18n = useNuxtApp().$i18n
defineOgImage({
  title: i18n.t('welcome'),
})
</script>

<template>
  <div>
    <h1>{{ $t('welcome') }}</h1>
  </div>
</template>
