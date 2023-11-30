<script setup lang="ts">
import { computed } from 'vue'

defineOptions({ inheritAttrs: false })

const props = withDefaults(defineProps<{
  title?: string
  themeColor?: string
}>(), {
  title: 'Welcome to the playground',
  themeColor: '#dbf4ff',
})

const theme = computed(() => props.themeColor || '#dbf4ff')
</script>

<template>
  <div class="main" :style="{ backgroundColor: theme }">
    <h1 class="underline">
      Hello World
    </h1>
  </div>
</template>

<style scoped>
.main {
  display: flex;
  align-items: center;
  justify-items: center;
  width: 100%;
  height: 100%;
  text-align: center;
}
h1 {
  flex-grow: 1;
  font-size: 6rem;
  font-weight: 700;
  color: white;
}
</style>
