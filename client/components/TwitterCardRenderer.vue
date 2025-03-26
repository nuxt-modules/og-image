<script setup lang="ts">
defineProps<{
  aspectRatio: number
  title?: string
}>()

const currTime = computed(() => {
  // need to return in format 2:17 AM · Mar 25, 2025
  const date = new Date()
  const options: Intl.DateTimeFormatOptions = {
    hour: 'numeric',
    minute: 'numeric',
    hour12: true,
    month: 'short',
    day: '2-digit',
    year: 'numeric',
  }
  const formatter = new Intl.DateTimeFormat('en-US', options)
  const parts = formatter.formatToParts(date)
  const time = `${parts.find(part => part.type === 'hour')?.value}:${
    parts.find(part => part.type === 'minute')?.value} ${
    parts.find(part => part.type === 'dayPeriod')?.value} · ${
    parts.find(part => part.type === 'month')?.value} ${
    parts.find(part => part.type === 'day')?.value}, ${
    parts.find(part => part.type === 'year')?.value}`
  return time
})
</script>

<template>
  <div class="root max-h-full relative flex flex-col">
    <div class="w-[600px] mx-auto">
      <div class="w-full flex items-start flex-col space-x-3">
        <div class="w-full">
          <div class="w-full">
            <div class="border border-gray-300 dark:border-gray-700 rounded-xl overflow-hidden">
              <div class="-mx-px" :style="{ aspectRatio }">
                <slot />
              </div>
              <div class="px-2 py-1">
                <p class="opacity-50 text-sm">
                  <slot name="domain" />
                </p>
                <p class="">
                  <slot name="title">
                    {{ title }}
                  </slot>
                </p>
              </div>
            </div>

            <p class="text-gray-500 mt-3 text-sm">
              {{ currTime }}
            </p>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
