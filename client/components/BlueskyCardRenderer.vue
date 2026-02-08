<script setup lang="ts">
</script>

<template>
  <div class="bluesky-card">
    <div class="bluesky-image">
      <slot />
      <div class="bluesky-image-overlay" />
    </div>
    <div class="bluesky-content">
      <p class="bluesky-title">
        <slot name="title" />
      </p>
      <p class="bluesky-description">
        <slot name="description" />
      </p>
      <div class="bluesky-domain">
        <svg class="bluesky-globe" viewBox="0 0 16 16" fill="none">
          <circle cx="8" cy="8" r="7" stroke="currentColor" stroke-width="1.3" />
          <ellipse cx="8" cy="8" rx="3.5" ry="7" stroke="currentColor" stroke-width="1.3" />
          <line x1="1.5" y1="5.5" x2="14.5" y2="5.5" stroke="currentColor" stroke-width="1.3" />
          <line x1="1.5" y1="10.5" x2="14.5" y2="10.5" stroke="currentColor" stroke-width="1.3" />
        </svg>
        <slot name="siteName" />
      </div>
    </div>
  </div>
</template>

<style>
.bluesky-card {
  width: 513px;
  margin: 0 auto;
  border-radius: 12px;
  overflow: hidden;
  border: 1px solid oklch(88% 0.01 260);
  background: oklch(100% 0 0);
  box-shadow: 0 4px 24px oklch(0% 0 0 / 0.08);
  font-family: 'Hubot Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
}

.dark .bluesky-card {
  background: #171d27;
  border-color: rgb(44, 58, 78);
  box-shadow: 0 4px 24px oklch(0% 0 0 / 0.25);
}

.bluesky-image {
  aspect-ratio: 2 / 1;
  width: 100%;
  position: relative;
  overflow: hidden;
  background: oklch(96% 0.01 260);
}

.dark .bluesky-image {
  background: oklch(22% 0.02 260);
}

.bluesky-image img,
.bluesky-image > *:first-child:not(.bluesky-image-overlay) {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.bluesky-image-overlay {
  position: absolute;
  inset: 0;
  box-shadow: inset 0 0 0 1px oklch(0% 0 0 / 0.05);
  pointer-events: none;
}

.dark .bluesky-image-overlay {
  box-shadow: inset 0 0 0 1px oklch(100% 0 0 / 0.05);
}

.bluesky-content {
  padding: 12px 14px;
}

.bluesky-title {
  font-size: 15px;
  font-weight: 600;
  color: oklch(15% 0.02 260);
  margin: 0 0 2px;
  line-height: 1.35;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.dark .bluesky-title {
  color: oklch(95% 0.01 260);
}

.bluesky-description {
  font-size: 13px;
  color: oklch(50% 0.02 260);
  margin: 0 0 8px;
  line-height: 1.4;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.dark .bluesky-description {
  color: oklch(65% 0.02 260);
}

.bluesky-domain {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 11.3px;
  letter-spacing: 0px;
  color: rgb(171, 184, 201);
  padding-top: 8px;
  border-top: 1px solid oklch(92% 0.01 260);
}

.dark .bluesky-domain {
  border-top-color: oklch(28% 0.02 260);
}

.bluesky-globe {
  width: 13px;
  height: 13px;
  flex-shrink: 0;
}
</style>
