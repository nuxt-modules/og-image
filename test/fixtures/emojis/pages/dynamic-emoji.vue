<script setup>
defineOgImage({
  component: 'DynamicEmoji',
  emoji: '👋',
  title: 'Dynamic Emoji Test',
})
</script>

<template>
  <div>
    <h1>Dynamic Emoji Test Page</h1>
    <p>This tests emojis passed dynamically via props (runtime handling)</p>
  </div>
</template>
