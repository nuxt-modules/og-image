<script setup lang="ts">
const { title = 'title', borderColor = '#3b82f6' } = defineProps<{
  title?: string
  borderColor?: string
}>()
</script>

<template>
  <div :style="{ borderColor }" class="h-full w-full flex items-start justify-start border-solid border-[12px] bg-gray-50">
    <div class="flex items-start justify-start h-full">
      <div class="flex flex-col justify-between w-full h-full">
        <h1 class="text-[80px] p-20 font-black text-left">
          {{ title }}
        </h1>
        <p class="text-2xl pb-10 px-20 font-bold mb-0">
          mycoolsite.com
        </p>
      </div>
    </div>
  </div>
</template>
