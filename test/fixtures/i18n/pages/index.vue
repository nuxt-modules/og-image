<script setup lang="ts">
import { switchLocalePath, useI18n } from '#imports'

const { locales, t } = useI18n()

defineOgImageComponent('NuxtSeo', {
  title: t('welcome'),
  description: t('description'),
  colorMode: 'dark',
})
</script>

<template>
  <div>
    <h1>{{ $t('welcome') }}</h1>
    <div>
      <NuxtLink
        v-for="locale in locales"
        :key="locale.code"
        :to="switchLocalePath(locale.code)"
      >
        <button type="button">
          {{ locale.code }}
        </button>
      </NuxtLink>
    </div>
  </div>
</template>
