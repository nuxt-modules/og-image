<script setup lang="ts">
const props = withDefaults(defineProps<{
  title?: string
  subtitle?: string
  tag?: string
}>(), {
  title: 'Complex Layout Test',
  subtitle: 'Testing multiple features',
  tag: 'Comparison',
})
</script>

<template>
  <div class="w-full h-full flex flex-col bg-gradient-to-br from-indigo-900 via-purple-900 to-pink-800 p-12">
    <!-- Header -->
    <div class="flex justify-between items-start mb-8">
      <div class="flex items-center gap-4">
        <div class="w-16 h-16 rounded-full bg-white/20 flex items-center justify-center">
          <span class="text-3xl">🚀</span>
        </div>
        <div class="flex flex-col">
          <span class="text-white/60 text-lg">nuxt-og-image</span>
          <span class="text-white font-semibold text-xl">v6.0</span>
        </div>
      </div>
      <div class="bg-white/10 px-4 py-2 rounded-full">
        <span class="text-white/80 text-sm">{{ tag }}</span>
      </div>
    </div>

    <!-- Main Content -->
    <div class="flex-1 flex flex-col justify-center">
      <h1 class="text-white text-6xl font-bold mb-4">
        {{ title }}
      </h1>
      <p class="text-white/70 text-2xl">
        {{ subtitle }}
      </p>
    </div>

    <!-- Footer -->
    <div class="flex justify-between items-end">
      <div class="flex gap-3">
        <div class="w-10 h-10 rounded-lg bg-green-500 flex items-center justify-center">
          <span class="text-white text-lg">✓</span>
        </div>
        <div class="w-10 h-10 rounded-lg bg-blue-500 flex items-center justify-center">
          <span class="text-white text-lg">⚡</span>
        </div>
        <div class="w-10 h-10 rounded-lg bg-orange-500 flex items-center justify-center">
          <span class="text-white text-lg">🔥</span>
        </div>
      </div>
      <div class="text-white/40 text-sm">
        nuxtseo.com
      </div>
    </div>
  </div>
</template>
