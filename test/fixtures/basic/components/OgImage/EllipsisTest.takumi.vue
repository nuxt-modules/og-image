<script setup lang="ts">
withDefaults(defineProps<{
  title?: string
  description?: string
}>(), {
  title: 'Privacy Policy',
  description: 'Welcome to our site. We are committed to protecting your privacy. This policy explains what data we collect, how we use it, and your rights regarding your information.',
})
</script>

<template>
  <div class="w-full h-full flex flex-col justify-center bg-gray-900 text-white" style="padding: 60px; gap: 24px;">
    <h1 class="text-7xl" style="letter-spacing: -0.05em; line-clamp: 1; text-overflow: ellipsis;">
      {{ title }}
    </h1>
    <p class="text-4xl" style="opacity: 0.7; line-clamp: 2; text-overflow: ellipsis;">
      {{ description }}
    </p>
  </div>
</template>
