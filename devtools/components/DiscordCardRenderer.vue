<script setup lang="ts">
</script>

<template>
  <div class="discord-card">
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
  max-width: 432px;
  margin: 0 auto;
  border-radius: 8px;
  border: 1px solid #e3e5e8;
  border-left: 4px solid #e3e5e8;
  background: #f2f3f5;
  overflow: hidden;
  font-family: 'gg sans', 'Noto Sans', 'Helvetica Neue', Helvetica, Arial, sans-serif;
}

.dark .discord-card {
  background: #2b2d31;
  border-color: #232428;
  border-left-color: #1e1f22;
}

.discord-body {
  flex: 1;
  min-width: 0;
  padding: 8px 16px 16px 12px;
}

.discord-sitename {
  font-size: 12px;
  font-weight: 400;
  color: #4e5058;
  margin-bottom: 2px;
  line-height: 16px;
}

.dark .discord-sitename {
  color: #b5bac1;
}

.discord-title {
  font-size: 16px;
  font-weight: 700;
  color: #006ce7;
  cursor: pointer;
  margin-bottom: 4px;
  line-height: 22px;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.dark .discord-title {
  color: #00a8fc;
}

.discord-title:hover {
  text-decoration: underline;
}

.discord-description {
  font-size: 14px;
  color: #313338;
  line-height: 18px;
  margin-bottom: 16px;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
  white-space: pre-wrap;
}

.dark .discord-description {
  color: #dbdee1;
}

.discord-image {
  border-radius: 4px;
  overflow: hidden;
  position: relative;
  max-width: 400px;
  max-height: 300px;
}

.discord-image img,
.discord-image > *:first-child:not(.discord-image-overlay) {
  max-width: 100%;
  max-height: 300px;
  border-radius: 4px;
  display: block;
}

.discord-image-overlay {
  position: absolute;
  inset: 0;
  box-shadow: inset 0 0 0 1px oklch(0% 0 0 / 0.04);
  border-radius: 4px;
  pointer-events: none;
}

.dark .discord-image-overlay {
  box-shadow: inset 0 0 0 1px oklch(100% 0 0 / 0.06);
}
</style>
