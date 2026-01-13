<script setup lang="ts">
/**
 * OG Image component using useI18n with loadLocaleMessages.
 *
 * Since OG image components render as Nuxt Islands (server components),
 * locale messages aren't automatically loaded. Use loadLocaleMessages()
 * to load them before translating.
 *
 * @see https://nuxtseo.com/og-image/guides/i18n
 */
const props = defineProps<{
  locale?: string
}>()

const { t, locale, loadLocaleMessages } = useI18n()

// Load messages for the requested locale, then set it as active
if (props.locale) {
  await loadLocaleMessages(props.locale)
  locale.value = props.locale
}
</script>

<template>
  <div class="w-full h-full flex flex-col justify-center items-center bg-white p-[60px]">
    <h1 class="text-[60px] font-bold">
      {{ t('welcome') }}
    </h1>
    <p class="text-[32px] text-gray-600">
      {{ t('description') }}
    </p>
    <p class="text-[24px] text-gray-400 mt-4">
      Locale: {{ locale }}
    </p>
  </div>
</template>
