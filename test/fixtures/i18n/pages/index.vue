<script setup lang="ts">
/**
 * Pattern 1: Props-based i18n (Recommended)
 *
 * Resolve translations at the page level and pass them as props.
 * This is the simplest and most reliable approach.
 *
 * @see https://nuxtseo.com/og-image/guides/i18n
 */
import { useI18n } from '#imports'

const { locale, locales, t } = useI18n()
const switchLocalePath = useSwitchLocalePath()

const availableLocales = computed(() => {
  return locales.value.filter(i => i.code !== locale.value)
})

// Pass already-translated strings as props
defineOgImage('NuxtSeo', {
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
