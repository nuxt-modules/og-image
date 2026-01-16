<script setup>
defineOgImage('EmojiAltTest', {})
</script>

<template>
  <div>
    <h1>Emoji Alt Text Bug Test</h1>
    <img alt="👋 This emoji should stay in alt text" src="data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgZmlsbD0iI2Y1ZjVmNSIvPjx0ZXh0IHg9IjUwIiB5PSI1NSIgZm9udC1mYW1pbHk9InNhbnMtc2VyaWYiIGZvbnQtc2l6ZT0iMTIiIGZpbGw9IiM2NjYiIHRleHQtYW5jaG9yPSJtaWRkbGUiPlRlc3Q8L3RleHQ+PC9zdmc+">
    <p>This emoji should become SVG: 👋</p>
  </div>
</template>
