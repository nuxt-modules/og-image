<script setup lang="ts">
const props = defineProps({
  backgroundColor: String,
  list: Array,
});
</script>
<template>
<div class="w-full h-full flex text-white items-center justify-center">
  <h1 :style="{ color: 'red', fontSize: '70px' }">{{ list }}</h1>
</div>
</template>
