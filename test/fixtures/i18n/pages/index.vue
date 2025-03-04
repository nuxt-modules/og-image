<script setup lang="ts">
import { useI18n } from '#imports'

const { locale, locales, t } = useI18n();
const switchLocalePath = useSwitchLocalePath();

const availableLocales = computed(() => {
  return locales.value.filter((i) => i.code !== locale.value);
});

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
        v-for="locale in availableLocales"
        :key="locale.code"
        :to="switchLocalePath(locale.code)"
      >
        <button type="button">{{ locale.code }}</button>
      </NuxtLink>
    </div>
  </div>
</template>
