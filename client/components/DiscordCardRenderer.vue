<script setup lang="ts">
</script>

<template>
  <div class="discord-card">
    <div class="discord-bar" />
    <div class="discord-body">
      <div class="discord-sitename">
        <slot name="siteName" />
      </div>
      <div class="discord-title">
        <slot name="title" />
      </div>
      <div class="discord-description">
        <slot name="description" />
      </div>
      <div class="discord-image">
        <slot />
        <div class="discord-image-overlay" />
      </div>
    </div>
  </div>
</template>

<style>
.discord-card {
  display: flex;
  max-width: 420px;
  margin: 0 auto;
  border-radius: 4px;
  background: #f2f3f5;
  padding: 12px 16px;
  box-shadow: 0 4px 24px oklch(0% 0 0 / 0.1);
  font-family: 'Hubot Sans', 'gg sans', 'Noto Sans', sans-serif;
}

.dark .discord-card {
  background: #2f3136;
  box-shadow: 0 4px 24px oklch(0% 0 0 / 0.25);
}

.discord-bar {
  width: 4px;
  border-radius: 4px;
  background: #5865f2;
  margin-right: 12px;
  flex-shrink: 0;
}

.discord-body {
  flex: 1;
  min-width: 0;
}

.discord-sitename {
  font-size: 12px;
  color: oklch(55% 0.04 285);
  margin-bottom: 4px;
}

.dark .discord-sitename {
  color: oklch(70% 0.03 285);
}

.discord-title {
  font-size: 16px;
  font-weight: 600;
  color: #006ce7;
  cursor: pointer;
  margin-bottom: 6px;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.dark .discord-title {
  color: #00aff4;
}

.discord-title:hover {
  text-decoration: underline;
}

.discord-description {
  font-size: 14px;
  color: oklch(40% 0.03 285);
  line-height: 1.4;
  margin-bottom: 12px;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.dark .discord-description {
  color: oklch(75% 0.02 285);
}

.discord-image {
  border-radius: 4px;
  overflow: hidden;
  position: relative;
  max-width: 100%;
  max-height: 300px;
}

.discord-image img,
.discord-image > *:first-child:not(.discord-image-overlay) {
  max-width: 100%;
  max-height: 300px;
  border-radius: 4px;
}

.discord-image-overlay {
  position: absolute;
  inset: 0;
  box-shadow: inset 0 0 0 1px oklch(0% 0 0 / 0.05);
  border-radius: 4px;
  pointer-events: none;
}

.dark .discord-image-overlay {
  box-shadow: inset 0 0 0 1px oklch(100% 0 0 / 0.05);
}
</style>
