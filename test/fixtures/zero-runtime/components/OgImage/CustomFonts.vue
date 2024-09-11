<script setup lang="ts">
import { computed } from 'vue'

// convert to typescript props
withDefaults(defineProps<{
  colorMode?: 'dark' | 'light'
  title?: string
  description?: string
}>(), {
  title: 'title',
})

const colorMode = computed(() => {
  return 'dark'
})
</script>

<template>
  <div
    style="font-family: 'test';"
    class="w-full h-full flex justify-between relative p-[60px]"
    :class="[
      colorMode === 'light' ? ['bg-white', 'text-gray-900'] : ['bg-gray-900', 'text-gray-50'],
    ]"
  >
    <div class="h-full w-full justify-between relative">
      <div class="flex flex-row justify-between items-start">
        <h1 class="m-0 mb-[30px] text-[75px]" style="font-family: 'optieinstein' !important; font-weight: 700">
          {{ title }}
        </h1>
        <p
          v-if="description" class="text-[35px]" :class="[
            colorMode === 'light' ? ['text-gray-700'] : ['text-gray-300'],
          ]"
          style="font-family: 'noto+sans', 'noto sans', 'inter' !important; font-weight: 600;"
        >
          {{ description }}
        </p>
      </div>
    </div>
  </div>
</template>
