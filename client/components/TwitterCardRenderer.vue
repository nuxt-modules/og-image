<script setup lang="ts">
</script>

<template>
  <div class="root max-h-full relative flex">
    <div class="max-h-full border-1 border-solid border-[#cfd9de] rounded-[16px] overflow-hidden">
      <div class="image-wrap">
        <slot />
      </div>
    </div>
    <div class="domain absolute bottom-3 bg-black/20 z-2 left-3 text-white">
      <slot name="domain" />
    </div>
  </div>
</template>

<style scoped>
.image-wrap {
  aspect-ratio: 1.90476 / 1;
  background-color: rgba(0, 0, 0, 0.1);
  opacity: 1;
  height: 315px;
}
.domain {
  word-wrap: break-word;
  text-overflow: unset;
  min-width: 0px;
  line-height: 16px;
  font-weight: 400;
  user-select: none;
  font-size: 13px;
  text-align: center;
  height: 20px;
  padding: 0 4px;
}
.root {
  outline-style: none;
  cursor: pointer;
  transition-duration: 0.2s;
}
</style>
