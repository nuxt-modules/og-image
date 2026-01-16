<script setup lang="ts">
/**
 * Pattern 2: Locale prop with loadLocaleMessages
 *
 * Pass the locale as a prop and use loadLocaleMessages() inside
 * the OG image component. This allows using useI18n() directly
 * in the component while still getting correct translations.
 *
 * @see https://nuxtseo.com/og-image/guides/i18n
 * @see https://github.com/nuxt-modules/og-image/issues/222
 */
import { useI18n } from '#imports'

const { locale, locales } = useI18n()
const switchLocalePath = useSwitchLocalePath()

const availableLocales = computed(() => {
  return locales.value.filter(i => i.code !== locale.value)
})

// Pass locale as prop - component will load messages for this locale
defineOgImage('I18nDirect', {
  locale: locale.value,
})
</script>

<template>
  <div>
    <h1>Direct i18n in OG Component Test</h1>
    <p>Current locale: {{ locale }}</p>
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
