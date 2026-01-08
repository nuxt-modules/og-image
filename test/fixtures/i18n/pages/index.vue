<script setup lang="ts">
import { useI18n } from '#imports'

const { locale, locales, t } = useI18n()
const switchLocalePath = useSwitchLocalePath()

const availableLocales = computed(() => {
  return locales.value.filter(i => i.code !== locale.value)
})

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
        v-for="availableLocale in availableLocales"
        :key="availableLocale.code"
        :to="switchLocalePath(availableLocale.code)"
      >
        <button type="button">
          {{ availableLocale.code }}
        </button>
      </NuxtLink>
    </div>
  </div>
</template>
