<script setup lang="ts">
withDefaults(defineProps<{
  title?: string
}>(), {
  title: 'Bold Title Test',
})
</script>

<template>
  <div class="w-full h-full bg-[#caa82b] p-12" style="font-family: 'Biz UDPGothic', sans-serif;">
    <div class="w-full h-full bg-white rounded-3xl p-12 pb-4 flex flex-col">
      <div class="text-[64px] leading-tight font-bold mb-4">
        {{ title }}
      </div>
      <div class="text-[40px] leading-tight font-normal text-gray-500">
        This text should be regular weight
      </div>
    </div>
  </div>
</template>
