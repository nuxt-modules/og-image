<script setup lang="ts">
defineProps<{
  aspectRatio?: number
}>()
</script>

<template>
  <div class="whatsapp-dual-preview">
    <!-- Inline style - appears when link is in message text -->
    <div class="whatsapp-section">
      <p class="whatsapp-label">
        Inline (in message)
      </p>
      <div class="whatsapp-inline-card">
        <div class="whatsapp-inline-image">
          <slot />
          <div class="whatsapp-image-overlay" />
        </div>
        <div class="whatsapp-inline-content">
          <div class="whatsapp-title-inline">
            <slot name="title" />
          </div>
          <div class="whatsapp-description-inline">
            <slot name="description" />
          </div>
          <div class="whatsapp-url-inline">
            <UIcon name="carbon:link" class="w-2.5 h-2.5" />
            <slot name="siteName" />
          </div>
        </div>
      </div>
    </div>

    <!-- Full card style - appears when link is standalone -->
    <div class="whatsapp-section">
      <p class="whatsapp-label">
        Full card (standalone link)
      </p>
      <div class="whatsapp-full-card">
        <div class="whatsapp-full-image">
          <slot />
          <div class="whatsapp-image-overlay" />
        </div>
        <div class="whatsapp-full-content">
          <div class="whatsapp-title">
            <slot name="title" />
          </div>
          <div class="whatsapp-description">
            <slot name="description" />
          </div>
          <div class="whatsapp-url">
            <UIcon name="carbon:link" class="w-3 h-3" />
            <slot name="url" />
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style>
.whatsapp-dual-preview {
  display: flex;
  gap: 24px;
  flex-wrap: wrap;
  font-family: 'Hubot Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
}

.whatsapp-section {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.whatsapp-label {
  font-size: 12px;
  color: oklch(55% 0.03 285);
  margin: 0;
}

.dark .whatsapp-label {
  color: oklch(60% 0.03 285);
}

/* Inline card - square thumbnail on left */
.whatsapp-inline-card {
  display: flex;
  max-width: 280px;
  border-radius: 8px;
  overflow: hidden;
  background: #dcf8c6;
  box-shadow: 0 4px 20px oklch(0% 0 0 / 0.1);
}

.dark .whatsapp-inline-card {
  background: #1f2c34;
  box-shadow: 0 4px 20px oklch(0% 0 0 / 0.2);
}

.whatsapp-inline-image {
  width: 64px;
  height: 64px;
  flex-shrink: 0;
  position: relative;
  overflow: hidden;
  background: oklch(85% 0.02 165);
}

.dark .whatsapp-inline-image {
  background: oklch(25% 0.03 165);
}

.whatsapp-inline-image img,
.whatsapp-inline-image > *:first-child:not(.whatsapp-image-overlay) {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.whatsapp-inline-content {
  padding: 8px;
  flex: 1;
  min-width: 0;
}

.whatsapp-title-inline {
  font-size: 12px;
  font-weight: 500;
  color: oklch(20% 0.02 285);
  display: -webkit-box;
  -webkit-line-clamp: 1;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.dark .whatsapp-title-inline {
  color: #e9edef;
}

.whatsapp-description-inline {
  font-size: 10px;
  color: oklch(40% 0.03 285);
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  margin-top: 2px;
}

.dark .whatsapp-description-inline {
  color: #8696a0;
}

.whatsapp-url-inline {
  font-size: 10px;
  color: oklch(50% 0.03 285);
  display: flex;
  align-items: center;
  gap: 4px;
  margin-top: 2px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.dark .whatsapp-url-inline {
  color: #8696a0;
}

/* Full card - 2:1 image on top */
.whatsapp-full-card {
  width: 280px;
  border-radius: 8px;
  overflow: hidden;
  background: #dcf8c6;
  box-shadow: 0 4px 20px oklch(0% 0 0 / 0.1);
}

.dark .whatsapp-full-card {
  background: #1f2c34;
  box-shadow: 0 4px 20px oklch(0% 0 0 / 0.2);
}

.whatsapp-full-image {
  aspect-ratio: 2 / 1;
  width: 100%;
  position: relative;
  overflow: hidden;
  background: oklch(85% 0.02 165);
}

.dark .whatsapp-full-image {
  background: oklch(25% 0.03 165);
}

.whatsapp-full-image img,
.whatsapp-full-image > *:first-child:not(.whatsapp-image-overlay) {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.whatsapp-full-content {
  padding: 12px;
  background: #dcf8c6;
}

.dark .whatsapp-full-content {
  background: #1f2c34;
}

.whatsapp-title {
  font-size: 14px;
  font-weight: 500;
  color: oklch(20% 0.02 285);
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.dark .whatsapp-title {
  color: #e9edef;
}

.whatsapp-description {
  font-size: 12px;
  color: oklch(40% 0.03 285);
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
  margin-top: 4px;
}

.dark .whatsapp-description {
  color: #8696a0;
}

.whatsapp-url {
  font-size: 12px;
  color: oklch(50% 0.03 285);
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 8px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.dark .whatsapp-url {
  color: #8696a0;
}

/* Shared overlay */
.whatsapp-image-overlay {
  position: absolute;
  inset: 0;
  box-shadow: inset 0 0 0 1px oklch(0% 0 0 / 0.05);
  pointer-events: none;
}

.dark .whatsapp-image-overlay {
  box-shadow: inset 0 0 0 1px oklch(100% 0 0 / 0.05);
}
</style>
