<script setup lang="ts">
import { computed } from 'vue'

const { title = 'Create stunning screen recordings', description = '' } = defineProps<{
  title?: string
  description?: string
}>()

const formattedTitle = computed(() => (title || '').slice(0, 60))
const formattedDescription = computed(() => (description || '').slice(0, 200))
</script>

<template>
  <div
    style="font-family: 'Public Sans', sans-serif;"
    class="relative font-sans flex h-full w-full overflow-hidden bg-[#f5f2ec] text-[#1d2433]"
  >
    <div class="relative z-10 flex h-full w-full flex-col justify-between p-20">
      <div class="flex flex-col gap-4">
        <h2 class="text-5xl font-bold leading-[0.96] tracking-normal text-[#222126]">
          {{ formattedTitle }}
        </h2>
        <p v-if="description" class="text-2xl font-normal leading-[1.18] tracking-tight text-[#34333a]">
          {{ formattedDescription }}
        </p>
      </div>
      <div class="flex items-center gap-3 text-xl text-[#34333a]">
        <span class="font-bold">www.canvid.com</span>
      </div>
    </div>
  </div>
</template>
