<script setup lang="ts">
</script>

<template>
  <div class="slack-card">
    <div class="slack-bar" />
    <div class="slack-content">
      <div class="slack-header">
        <div class="slack-favicon">
          <slot name="favIcon" />
        </div>
        <div class="slack-sitename">
          <slot name="siteName" />
        </div>
      </div>
      <div class="slack-title">
        <slot name="title" />
      </div>
      <div class="slack-description">
        <slot name="description" />
      </div>
      <div class="slack-image">
        <slot />
        <div class="slack-image-overlay" />
      </div>
    </div>
  </div>
</template>

<style>
.slack-card {
  display: flex;
  font-family: 'Hubot Sans', Lato, -apple-system, BlinkMacSystemFont, sans-serif;
  font-size: 15px;
  line-height: 1.46;
  -webkit-font-smoothing: antialiased;
  min-height: 200px;
  max-width: 500px;
  background: oklch(100% 0 0);
  border-radius: 8px;
  padding: 8px 0;
}

.dark .slack-card {
  background: #1a1d21;
}

.slack-bar {
  flex-shrink: 0;
  width: 4px;
  background: #a855f7;
  border-radius: 4px;
  margin: 4px 0;
}

.slack-content {
  padding: 0 12px;
  flex: 1;
  min-width: 0;
}

.slack-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 4px;
}

.slack-favicon img {
  border-radius: 3px;
  height: 16px;
  width: 16px;
  object-fit: cover;
}

.slack-sitename {
  font-weight: 700;
  font-size: 14px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.slack-title {
  color: #1264a3;
  font-weight: 600;
  font-size: 15px;
  margin-bottom: 2px;
  cursor: pointer;
}

.dark .slack-title {
  color: #1d9bd1;
}

.slack-title:hover {
  text-decoration: underline;
}

.slack-description {
  color: oklch(55% 0.04 285);
  font-size: 14px;
  line-height: 1.5;
  margin-bottom: 8px;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.dark .slack-description {
  color: oklch(70% 0.03 285);
}

.slack-image {
  border-radius: 6px;
  overflow: hidden;
  max-width: 320px;
  position: relative;
}

.slack-image img,
.slack-image > *:first-child:not(.slack-image-overlay) {
  width: 100%;
  height: auto;
}

.slack-image-overlay {
  position: absolute;
  inset: 0;
  box-shadow: inset 0 0 0 1px oklch(0% 0 0 / 0.05);
  border-radius: 6px;
  pointer-events: none;
}

.dark .slack-image-overlay {
  box-shadow: inset 0 0 0 1px oklch(100% 0 0 / 0.05);
}
</style>
