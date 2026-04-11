<script lang="ts" setup>
const route = useRoute()
const title = computed(() => String(route.query.title || 'Default Title'))

defineOgImage('NuxtSeo.satori', { title })

useSeoMeta({
  title: () => title.value,
})
</script>

<template>
  <div>
    <h1>{{ title }}</h1>
  </div>
</template>
