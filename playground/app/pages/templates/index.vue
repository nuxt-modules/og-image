<script setup lang="ts">
const templates = [
  { name: 'NuxtSeo', slug: 'nuxt-seo', description: 'Flexible theme-aware template with icon support' },
  { name: 'Nuxt', slug: 'nuxt', description: 'Official Nuxt branding with SVG graphics' },
  { name: 'WithEmoji', slug: 'with-emoji', description: 'Centered emoji with title' },
  { name: 'SimpleBlog', slug: 'simple-blog', description: 'Clean minimal blog template with auto URL' },
  { name: 'Frame', slug: 'frame', description: 'Dark framed design with socials' },
  { name: 'Pergel', slug: 'pergel', description: 'Warm gradient blobs on dark' },
  { name: 'UnJs', slug: 'un-js', description: 'Package stats display for repos' },
  { name: 'Brutalist', slug: 'brutalist', description: 'Neo-brutalist bold typography' },
  { name: 'BlogPost', slug: 'blog-post', description: 'Sleek blog post with author and category' },
  { name: 'Docs', slug: 'docs', description: 'Professional documentation template' },
  { name: 'ProductCard', slug: 'product-card', description: 'Vibrant product showcase card' },
]

const errors = ref<Record<string, boolean>>({})
</script>

<template>
  <div class="space-y-6">
    <UPageHeader
      title="OG Image Templates"
      description="Community templates for Nuxt OG Image"
    />

    <UPageGrid>
      <UPageCard
        v-for="template in templates"
        :key="template.name"
        :title="template.name"
        :description="template.description"
        :to="`/templates/${template.slug}`"
      >
        <div class="aspect-[1200/630] bg-(--ui-bg-muted) relative overflow-hidden rounded-lg">
          <img
            :src="`/__og-image__/image/templates/${template.slug}/og.png`"
            :alt="template.name"
            class="w-full h-full object-cover"
            loading="lazy"
            @error="errors[template.name] = true"
          >
          <div
            v-if="errors[template.name]"
            class="absolute inset-0 flex items-center justify-center text-(--ui-text-muted)"
          >
            Failed to load
          </div>
        </div>
      </UPageCard>
    </UPageGrid>
  </div>
</template>
