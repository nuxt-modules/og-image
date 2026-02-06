<script setup lang="ts">
import { ref } from 'vue'

const templates = [
  { name: 'BlogPost', slug: 'blog-post', description: 'Sleek blog post with author and category' },
  { name: 'Docs', slug: 'docs', description: 'Professional documentation template' },
  { name: 'NuxtSeo', slug: 'nuxt-seo', description: 'Nuxt SEO branding with gradient backgrounds' },
  { name: 'ProductCard', slug: 'product-card', description: 'Vibrant product showcase card' },
]

const errors = ref<Record<string, boolean>>({})
</script>

<template>
  <div class="min-h-screen bg-gray-100 py-12 px-8">
    <div class="max-w-7xl mx-auto">
      <h1 class="text-4xl font-bold text-gray-900 mb-2">
        Takumi Templates
      </h1>
      <p class="text-lg text-gray-600 mb-8">
        Takumi renderer community templates
      </p>

      <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
        <NuxtLink
          v-for="template in templates"
          :key="template.name"
          :to="`/takumi/${template.slug}`"
          class="group block bg-white rounded-xl shadow-sm hover:shadow-lg transition-shadow overflow-hidden"
        >
          <div class="aspect-[1200/630] bg-gray-200 relative overflow-hidden">
            <img
              :src="`/__og-image__/image/takumi/${template.name}/og.png`"
              :alt="template.name"
              class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
              loading="lazy"
              @error="errors[template.name] = true"
            >
            <div
              v-if="errors[template.name]"
              class="absolute inset-0 flex items-center justify-center bg-gray-100 text-gray-400"
            >
              Failed to load
            </div>
          </div>
          <div class="p-4">
            <h3 class="font-semibold text-gray-900 group-hover:text-blue-600 transition-colors">
              {{ template.name }}
            </h3>
            <p class="text-sm text-gray-500 mt-1">
              {{ template.description }}
            </p>
          </div>
        </NuxtLink>
      </div>
    </div>
  </div>
</template>
