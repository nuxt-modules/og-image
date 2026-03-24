<script lang="ts" setup>
const { t, locale } = useI18n()

defineOgImage('Localized', {
  title: t('og.title'),
  description: t('og.description'),
  locale: locale.value,
})
</script>

<template>
  <div>
    <h1>{{ t('page.heading') }}</h1>
    <p>{{ t('page.description') }}</p>
    <p>
      View your OG image at <a href="/__og-image__/image/og.png">/__og-image__/image/og.png</a>
    </p>
  </div>
</template>
