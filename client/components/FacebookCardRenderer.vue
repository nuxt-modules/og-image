<script setup lang="ts">
defineProps<{
  aspectRatio?: number
}>()
</script>

<template>
  <div class="facebook-card">
    <div class="facebook-image">
      <slot />
      <div class="facebook-image-overlay" />
    </div>
    <div class="facebook-content">
      <p class="facebook-sitename">
        <slot name="siteName" />
      </p>
      <p class="facebook-title">
        <slot name="title" />
      </p>
      <p class="facebook-description">
        <slot name="description" />
      </p>
    </div>
  </div>
</template>

<style>
.facebook-card {
  max-width: 500px;
  border-radius: 0;
  overflow: hidden;
  border: 1px solid #dadde1;
  background: #f0f2f5;
  box-shadow: 0 4px 24px oklch(0% 0 0 / 0.1);
  font-family: 'Hubot Sans', Helvetica, Arial, sans-serif;
}

.dark .facebook-card {
  background: #242526;
  border-color: oklch(28% 0.02 285);
  box-shadow: 0 4px 24px oklch(0% 0 0 / 0.2);
}

.facebook-image {
  aspect-ratio: 2 / 1;
  width: 100%;
  position: relative;
  overflow: hidden;
  background: #e4e6e9;
}

.dark .facebook-image {
  background: oklch(25% 0.02 285);
}

.facebook-image img,
.facebook-image > *:first-child:not(.facebook-image-overlay) {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.facebook-image-overlay {
  position: absolute;
  inset: 0;
  box-shadow: inset 0 0 0 1px oklch(0% 0 0 / 0.05);
}

.dark .facebook-image-overlay {
  box-shadow: inset 0 0 0 1px oklch(100% 0 0 / 0.05);
}

.facebook-content {
  padding: 12px 14px;
  background: #f0f2f5;
}

.dark .facebook-content {
  background: #242526;
}

.facebook-sitename {
  font-size: 12px;
  color: #606770;
  text-transform: uppercase;
  letter-spacing: 0.03em;
  margin: 0 0 4px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.dark .facebook-sitename {
  color: oklch(60% 0.02 285);
}

.facebook-title {
  font-size: 16px;
  font-weight: 600;
  color: #1c1e21;
  margin: 0 0 4px;
  line-height: 1.3;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.dark .facebook-title {
  color: oklch(95% 0.01 285);
}

.facebook-description {
  font-size: 14px;
  color: #606770;
  margin: 0;
  line-height: 1.4;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.dark .facebook-description {
  color: oklch(70% 0.02 285);
}
</style>
