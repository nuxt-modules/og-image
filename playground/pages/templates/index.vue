<script setup lang="ts">
import { ref } from 'vue'

const templates = [
  { name: 'NuxtSeo', description: 'Flexible theme-aware template with icon support' },
  { name: 'Nuxt', description: 'Official Nuxt branding with SVG graphics' },
  { name: 'WithEmoji', description: 'Centered emoji with title' },
  { name: 'SimpleBlog', description: 'Clean minimal blog template with auto URL' },
  { name: 'Frame', description: 'Dark framed design with socials' },
  { name: 'Pergel', description: 'Warm gradient blobs on dark' },
  { name: 'UnJs', description: 'Package stats display for repos' },
  { name: 'Brutalist', description: 'Neo-brutalist bold typography' },
  { name: 'Aurora', description: 'Glassmorphism northern lights' },
  { name: 'Retro', description: 'Synthwave retro-futuristic' },
  { name: 'Newspaper', description: 'Editorial magazine style' },
]

const loading = ref<Record<string, boolean>>({})
const errors = ref<Record<string, boolean>>({})

const handleLoad = (name: string) => {
  loading.value[name] = false
}

const handleError = (name: string) => {
  loading.value[name] = false
  errors.value[name] = true
}
</script>

<template>
  <div class="min-h-screen bg-gray-100 py-12 px-8">
    <div class="max-w-7xl mx-auto">
      <h1 class="text-4xl font-bold text-gray-900 mb-2">
        OG Image Templates
      </h1>
      <p class="text-lg text-gray-600 mb-8">
        Community templates for Nuxt OG Image
      </p>

      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <NuxtLink
          v-for="template in templates"
          :key="template.name"
          :to="`/templates/${template.name}`"
          class="group block bg-white rounded-xl shadow-sm hover:shadow-lg transition-shadow overflow-hidden"
        >
          <div class="aspect-[1200/630] bg-gray-200 relative overflow-hidden">
            <img
              :src="`/__og-image__/image/templates/${template.name}/og.png`"
              :alt="template.name"
              class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
              loading="lazy"
              @load="handleLoad(template.name)"
              @error="handleError(template.name)"
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
