<script setup lang="ts">
defineProps<{
  aspectRatio?: number
}>()
</script>

<template>
  <div class="linkedin-card">
    <div class="linkedin-image">
      <slot />
      <div class="linkedin-image-overlay" />
    </div>
    <div class="linkedin-content">
      <p class="linkedin-title">
        <slot name="title" />
      </p>
      <p class="linkedin-sitename">
        <slot name="siteName" />
      </p>
    </div>
  </div>
</template>

<style>
.linkedin-card {
  max-width: 500px;
  border-radius: 8px;
  overflow: hidden;
  border: 1px solid #e0e0e0;
  background: oklch(100% 0 0);
  box-shadow: 0 4px 24px oklch(0% 0 0 / 0.1);
  font-family: 'Hubot Sans', -apple-system, BlinkMacSystemFont, sans-serif;
}

.dark .linkedin-card {
  background: #1b1f23;
  border-color: oklch(28% 0.02 285);
  box-shadow: 0 4px 24px oklch(0% 0 0 / 0.2);
}

.linkedin-image {
  aspect-ratio: 2 / 1;
  width: 100%;
  position: relative;
  overflow: hidden;
  background: #f3f2ef;
}

.dark .linkedin-image {
  background: oklch(22% 0.02 285);
}

.linkedin-image img,
.linkedin-image > *:first-child:not(.linkedin-image-overlay) {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.linkedin-image-overlay {
  position: absolute;
  inset: 0;
  box-shadow: inset 0 0 0 1px oklch(0% 0 0 / 0.05);
}

.dark .linkedin-image-overlay {
  box-shadow: inset 0 0 0 1px oklch(100% 0 0 / 0.05);
}

.linkedin-content {
  padding: 12px 14px;
}

.linkedin-title {
  font-size: 14px;
  font-weight: 600;
  color: oklch(15% 0.02 285);
  margin: 0 0 4px;
  line-height: 1.3;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.dark .linkedin-title {
  color: oklch(95% 0.01 285);
}

.linkedin-sitename {
  font-size: 12px;
  color: oklch(50% 0.03 285);
  margin: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
</style>
