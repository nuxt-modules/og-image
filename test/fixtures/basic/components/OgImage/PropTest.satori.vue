<script setup lang="ts">
withDefaults(defineProps<{
  logo?: string
}>(), {
  logo: '',
})
</script>

<template>
  <div class="w-full h-full flex items-center justify-center bg-white">
    <p class="text-2xl">
      {{ logo }}
    </p>
  </div>
</template>
