<script setup lang="ts">
</script>

<template>
  <div class="root">
    <div class="bar" />
    <div class="content">
      <div class="flex items-center space-x-2">
        <div class="favIcon">
          <slot name="favIcon" />
        </div>
        <div class="siteName">
          <slot name="siteName" />
        </div>
      </div>
      <div class="title">
        <slot name="title" />
      </div>
      <div class="description">
        <slot name="description" />
      </div>
      <slot />
    </div>
  </div>
</template>

<style scoped>
.favIcon >>> img {
  border-radius: 2px;
  box-sizing: content-box;
  height: 16px;
  margin-right: 6px;
  overflow: hidden;
  vertical-align: middle;
  width: 16px;
}
.root {
  display: flex;
  font-family: Noto Sans,NotoSansJP,Slack-Lato,Lato,appleLogo,sans-serif;
  font-size: 15px;
  line-height: 1.46666667;
  word-wrap: break-word;
  -webkit-font-smoothing: antialiased;
  text-rendering: optimizeLegibility;
}
.siteName {
  font-weight: bold;
  flex: 1 1;
  overflow: hidden;
  word-wrap: break-word;
}
.description {
  color: #2c2d30;
}
.title {
  color: #0576b9;
  font-weight: 700;
  font-feature-settings: "liga","clig";
  font-variant-ligatures: common-ligatures;
}
.content {
  padding: 0 12px;
  max-width: 520px;
}
.bar {
  flex-shrink: 0;
  width: 4px;
  background-color: #e8e8e8;
  border-radius: 8px;
}
</style>
