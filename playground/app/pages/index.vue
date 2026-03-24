<script setup lang="ts">
useServerSeoMeta({
  title: 'OG Image Playground',
  description: 'Test all OG image renderers and templates',
  ogTitle: 'OG Image Playground',
})

defineOgImage('NuxtSeo.takumi', {
  theme: '#fcfcfc',
  colorMode: 'dark',
})

const sections = [
  {
    title: 'Templates',
    icon: 'i-lucide-layout-template',
    items: [
      { label: 'Template Gallery', to: '/templates', icon: 'i-lucide-grid-3x3', description: 'Browse all community OG image templates' },
      { label: 'NuxtSeo', to: '/templates/nuxt-seo' },
      { label: 'Nuxt', to: '/templates/nuxt' },
      { label: 'With Emoji', to: '/templates/with-emoji' },
      { label: 'Simple Blog', to: '/templates/simple-blog' },
      { label: 'Frame', to: '/templates/frame' },
      { label: 'Pergel', to: '/templates/pergel' },
      { label: 'UnJS', to: '/templates/un-js' },
      { label: 'Brutalist', to: '/templates/brutalist' },
      { label: 'Blog Post', to: '/templates/blog-post' },
      { label: 'Docs', to: '/templates/docs' },
      { label: 'Product Card', to: '/templates/product-card' },
    ],
  },
  {
    title: 'Satori',
    icon: 'i-lucide-image',
    items: [
      { label: 'Default', to: '/satori/', description: 'Default satori example with options' },
      { label: 'Image', to: '/satori/image' },
      { label: 'Inline', to: '/satori/inline' },
      { label: 'JPEG', to: '/satori/jpeg' },
      { label: 'Dimensions', to: '/satori/dimensions' },
      { label: 'Emoji', to: '/satori/emoji' },
      { label: 'Tailwind', to: '/satori/tailwind' },
      { label: 'Scoped CSS', to: '/satori/scoped-css' },
      { label: 'Custom Font', to: '/satori/custom-font' },
      { label: 'Nuxt Icon', to: '/satori/nuxt-icon' },
      { label: 'Long Content', to: '/satori/long-content' },
      { label: 'Mounted', to: '/satori/mounted' },
      { label: 'Not Supported', to: '/satori/not-supported' },
      { label: 'Old Props', to: '/satori/old-props' },
      { label: 'Query Param', to: '/satori/query-param' },
      { label: 'Reactive Props', to: '/satori/reactive-props' },
      { label: 'Static', to: '/satori/static' },
      { label: 'With Options', to: '/satori/with-options' },
      { label: 'Time', to: '/satori/time' },
      { label: 'Route Rules', to: '/satori/route-rules/default' },
      { label: 'Route Rules Nested', to: '/satori/route-rules/nested/default' },
    ],
  },
  {
    title: 'Takumi',
    icon: 'i-lucide-paintbrush',
    items: [
      { label: 'Default', to: '/takumi/' },
      { label: 'Blog Post', to: '/takumi/blog-post' },
      { label: 'Docs', to: '/takumi/docs' },
      { label: 'NuxtSeo', to: '/takumi/nuxt-seo' },
      { label: 'Product Card', to: '/takumi/product-card' },
      { label: 'SVG', to: '/takumi-svg' },
      { label: 'SVG Showcase', to: '/takumi-svg-showcase' },
    ],
  },
  {
    title: 'Chromium',
    icon: 'i-lucide-chrome',
    items: [
      { label: 'Screenshot', to: '/chromium/screenshot' },
      { label: 'Component', to: '/chromium/component' },
      { label: 'Delayed', to: '/chromium/delayed' },
      { label: 'Search', to: '/chromium/search' },
    ],
  },
  {
    title: 'Other',
    icon: 'i-lucide-more-horizontal',
    items: [
      { label: 'Multiple Images', to: '/multiple' },
      { label: 'Prebuilt URL', to: '/prebuilt' },
      { label: 'Prebuilt Reactive', to: '/prebuilt-reactive' },
      { label: 'Virtual Image', to: '/virtual-image' },
      { label: 'Chinese Text', to: '/chinese' },
      { label: 'Search Query', to: '/search?foo=bar' },
      { label: 'Test (Octopo)', to: '/test' },
      { label: 'Not Prerendered', to: '/not-prerendered' },
      { label: 'Not Found', to: '/not-found' },
      { label: 'No OG (Index)', to: '/none/' },
      { label: 'No OG (Extended)', to: '/none/extended' },
      { label: 'No OG (Route Rules)', to: '/none/route-rules' },
    ],
  },
]
</script>

<template>
  <div class="space-y-8">
    <UPageHeader
      title="OG Image Playground"
      description="Test all OG image renderers, templates, and configurations."
    />

    <div v-for="section in sections" :key="section.title" class="space-y-3">
      <h2 class="text-lg font-semibold flex items-center gap-2">
        <UIcon :name="section.icon" class="size-5" />
        {{ section.title }}
      </h2>

      <div class="flex flex-wrap gap-2">
        <UButton
          v-for="item in section.items"
          :key="item.to"
          :to="item.to"
          :label="item.label"
          variant="soft"
          size="sm"
        />
      </div>
    </div>
  </div>
</template>
