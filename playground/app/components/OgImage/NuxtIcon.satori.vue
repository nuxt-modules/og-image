<script setup lang="ts">
defineProps({
  path: String,
  title: String,
  description: String,
})
</script>

<template>
  <div style="padding: 0 60px; width: 100%; height: 100%; background-color: #0c0c0c; background-image: linear-gradient(to bottom right, #111827, #0E262C 75%); display: flex; align-items: center; color: white;">
    <div style="display: block; line-clamp: 2; text-overflow: ellipsis;">
      {{ title }}
    </div>
    <div style="display: block; line-clamp: 2; text-overflow: ellipsis;">
      {{ description }}
    </div>
    <Icon mode="svg" name="carbon:book" size="250px" class="size-30 text-blue-500/30" style="margin: 0 auto;" />
    <Icon name="carbon:star" size="250px" class="size-30 text-blue-500" style="margin: 0 auto;" />
    <Icon mode="svg" name="carbon:logo-github" size="250px" class="size-30 text-blue-500" style="margin: 0 auto;" />
  </div>
</template>
