<script setup lang="ts">
const props = defineProps({
  // these will always be provided
  path: String,
  title: String,
  description: String,
  // anything custom comes here
  backgroundImage: String
})
</script>

<template>
  <div class="wrap">
    <div>
      <h1>
        {{ title }}
      </h1>
      <p>{{ description }}</p>
    </div>
  </div>
</template>

<style scoped>
.wrap {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  background: linear-gradient(to bottom, #30e8bf, #ff8235);
}

h1 {
  font-size: 4rem;
}
</style>
