<script setup lang="ts">
defineOgImage('ProductCard', {
  productName: 'Takumi Pro',
  price: '$299',
  description: 'The ultimate image generation engine for your next project.',
  brand: 'Takumi',
  image: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=600&q=80',
})
</script>

<template>
  <div class="p-8">
    <h1 class="text-2xl font-bold mb-4">
      ProductCard Template (Takumi)
    </h1>
    <a href="/__og-image__/image/takumi/ProductCard/og.png" target="_blank" class="text-blue-500 underline">View OG Image</a>
  </div>
</template>
