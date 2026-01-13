<script setup lang="ts">
withDefaults(defineProps<{
  description?: string
  headline?: string
  name?: string
  siteConfigName?: string
  title?: string
}>(), {
  description: '',
  headline: 'Adelaide DJ',
  name: 'DJ cReal',
  siteConfigName: 'cReal',
  title: 'cReal',
})
</script>

<template>
  <div class="h-full w-full flex bg-gray-800 text-gray-50">
    <img
      alt="DJ cReal"
      src="/assets/static/images/og.jpg"
      :width="400"
      :height="600"
    >
    <div class="ml-16 flex flex-col justify-center">
      <img
        alt="DJ cReal"
        class="absolute left-[100px] opacity-[0.025]"
        src="/assets/static/logos/creal.svg"
        :width="700"
        :height="700"
      >
      <template v-if="title !== siteConfigName">
        <div class="mt-20 text-[40px] font-semibold text-gray-300">
          {{ siteConfigName }}
        </div>
        <h1 class="text-[72px] leading-none">
          {{ title }}
        </h1>
      </template>
      <template v-else>
        <div class="mt-20 text-[40px] font-semibold text-gray-300">
          {{ headline }}
        </div>
        <h1 class="text-[72px] leading-none">
          {{ name }}
        </h1>
      </template>
    </div>
  </div>
</template>
