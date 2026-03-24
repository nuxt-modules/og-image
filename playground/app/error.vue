<script lang="ts" setup>
const { error } = defineProps<{
  error: import('#app').NuxtError
}>()

defineOgImage('NuxtSeo', {
  title: error.statusCode.toString(),
  description: error.statusMessage,
  theme: '#fcfcfc',
  colorMode: 'dark',
})
</script>

<template>
  <UApp>
    <UContainer class="py-12 text-center">
      <h1 class="text-4xl font-bold">
        {{ error.statusCode }}
      </h1>
      <p class="mt-2 text-(--ui-text-muted)">
        {{ error.statusMessage }}
      </p>
      <UButton to="/" label="Go home" class="mt-6" />
    </UContainer>
  </UApp>
</template>
