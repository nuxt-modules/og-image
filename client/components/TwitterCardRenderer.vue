<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  aspectRatio: number
  title?: string
  cardType?: 'summary' | 'summary_large_image'
}>()

const currTime = computed(() => {
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
  return `${parts.find(part => part.type === 'hour')?.value}:${
    parts.find(part => part.type === 'minute')?.value} ${
    parts.find(part => part.type === 'dayPeriod')?.value} · ${
    parts.find(part => part.type === 'month')?.value} ${
    parts.find(part => part.type === 'day')?.value}, ${
    parts.find(part => part.type === 'year')?.value}`
})

// Auto-detect if should show summary (square) card based on aspect ratio
// Use summary card for square-ish images (aspect ratio close to 1)
const isSmallCard = computed(() => {
  if (props.cardType)
    return props.cardType === 'summary'
  // Auto-detect: aspect ratio < 1.3 is considered square-ish
  return props.aspectRatio < 1.3
})
</script>

<template>
  <div class="twitter-card">
    <div class="w-[600px] mx-auto">
      <div
        class="card-container"
        :class="isSmallCard ? 'flex' : ''"
      >
        <div
          class="card-image"
          :class="isSmallCard ? 'w-32 h-32 shrink-0' : 'aspect-[2/1] w-full'"
          :style="isSmallCard ? {} : { aspectRatio }"
        >
          <slot />
          <div class="card-image-overlay" />
        </div>
        <div class="card-content" :class="isSmallCard ? 'flex-1 min-w-0' : ''">
          <p class="card-domain">
            <slot name="domain" />
          </p>
          <p class="card-title">
            <slot name="title">
              {{ title }}
            </slot>
          </p>
        </div>
      </div>
      <p class="card-time">
        {{ currTime }}
      </p>
    </div>
  </div>
</template>

<style>
.twitter-card {
  font-family: 'Hubot Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  max-height: 100%;
  position: relative;
  display: flex;
  flex-direction: column;
}

.twitter-card .card-container {
  border-radius: 16px;
  overflow: hidden;
  border: 1px solid oklch(92% 0.01 285);
  background: oklch(100% 0 0);
  box-shadow: 0 4px 24px oklch(0% 0 0 / 0.06);
  transition: border-color 0.2s ease, box-shadow 0.2s ease;
}

.dark .twitter-card .card-container {
  border-color: oklch(28% 0.04 285);
  background: oklch(18% 0.04 285);
  box-shadow: 0 4px 24px oklch(0% 0 0 / 0.2);
}

.twitter-card .card-container:hover {
  border-color: oklch(85% 0.02 285);
  box-shadow: 0 6px 32px oklch(0% 0 0 / 0.1);
}

.dark .twitter-card .card-container:hover {
  border-color: oklch(35% 0.04 285);
}

.twitter-card .card-image {
  position: relative;
  overflow: hidden;
  background: oklch(96% 0.01 285);
}

.dark .twitter-card .card-image {
  background: oklch(22% 0.04 285);
}

.twitter-card .card-image img,
.twitter-card .card-image > *:first-child:not(.card-image-overlay) {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.twitter-card .card-image-overlay {
  position: absolute;
  inset: 0;
  box-shadow: inset 0 0 0 1px oklch(0% 0 0 / 0.05);
}

.dark .twitter-card .card-image-overlay {
  box-shadow: inset 0 0 0 1px oklch(100% 0 0 / 0.05);
}

.twitter-card .card-content {
  padding: 12px 14px;
}

.twitter-card .card-domain {
  font-size: 13px;
  color: oklch(55% 0.04 285);
  margin: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.twitter-card .card-title {
  font-size: 15px;
  font-weight: 500;
  margin: 2px 0 0;
  line-height: 1.3;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.twitter-card .card-time {
  margin-top: 12px;
  font-size: 14px;
  color: oklch(55% 0.04 285);
}
</style>
