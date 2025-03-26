<script setup lang="ts">
</script>

<template>
  <div style="max-width: 600px; background-color: #00574B; font-size: 14.2px; line-height: 19px; color: white; padding: 6px; border-radius: 7.5px; box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);">
    <div class="flex items-center" style="background-color: #025144; border-radius: 8px; overflow: hidden;">
      <div style="aspect-ratio: 1/1;">
        <slot />
      </div>
      <div style="padding: 6px 10px;">
        <div class="font-bold" style="-webkit-line-clamp: 2; color: rgba(233, 237, 239, 0.88)">
          <slot name="title" />
        </div>
        <div style="font-size: .75rem; -webkit-line-clamp: 2; color: rgba(233, 237, 239, 0.88)">
          <slot name="description" />
        </div>
        <div style="font-size: .75rem;  color: rgba(233, 237, 239, 0.3)">
          <slot name="url" />
        </div>
      </div>
    </div>
    <div style="padding: 6px 10px;">
      When someone sends quite a long message with a link that has an og:image, the og:image is made into a square. For example <span style="color: #53bdeb"><slot name="url" /></span>
    </div>
  </div>
</template>
