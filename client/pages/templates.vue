<script lang="ts" setup>
import { navigateTo } from '#imports'
import { withQuery } from 'ufo'
import { useOgImage } from '../composables/og-image'

const {
  appComponents,
  communityComponents,
  activeComponentName,
  src,
  aspectRatio,
  isLoading,
  patchOptions,
} = useOgImage()

function selectTemplate(componentName: string) {
  patchOptions({ component: componentName })
  navigateTo('/')
}
</script>

<template>
  <div class="templates-page animate-fade-up">
    <!-- Loading state -->
    <div v-if="isLoading" class="loading-container">
      <div class="loading-spinner" />
      <p class="loading-text">
        Loading templates&#8230;
      </p>
    </div>

    <!-- Content -->
    <div v-else class="templates-content stagger-children">
      <!-- Your Templates -->
      <OSectionBlock v-if="appComponents.length" icon="carbon:app" text="Your Templates">
        <template #description>
          Custom OG Image components in your project
        </template>
        <div class="template-grid">
          <button
            v-for="name in appComponents"
            :key="name.pascalName"
            class="template-item"
            @click="selectTemplate(name.pascalName)"
          >
            <TemplateComponentPreview
              :component="name"
              :src="withQuery(src, { component: name.pascalName })"
              :aspect-ratio="aspectRatio"
              :active="name.pascalName === activeComponentName"
            />
          </button>
        </div>
      </OSectionBlock>

      <!-- Community Templates -->
      <OSectionBlock icon="carbon:user-multiple" text="Community Templates">
        <template #description>
          Pre-built templates you can use or eject
        </template>
        <div class="template-grid">
          <button
            v-for="name in communityComponents"
            :key="name.pascalName"
            class="template-item"
            @click="selectTemplate(name.pascalName)"
          >
            <TemplateComponentPreview
              :component="name"
              :src="withQuery(src, { component: name.pascalName })"
              :aspect-ratio="aspectRatio"
              :active="name.pascalName === activeComponentName"
            />
          </button>
        </div>
      </OSectionBlock>
    </div>
  </div>
</template>

<style scoped>
.templates-page {
  padding-bottom: 2rem;
}

.loading-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 300px;
  gap: 1rem;
}

.loading-spinner {
  width: 2.5rem;
  height: 2.5rem;
  border: 2px solid var(--color-border);
  border-top-color: var(--seo-green);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.loading-text {
  font-size: 0.875rem;
  color: var(--color-text-muted);
}

.templates-content {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.template-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 1rem;
}

@media (min-width: 640px) {
  .template-grid {
    grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
    gap: 1.25rem;
  }
}

.template-item {
  padding: 0;
  background: none;
  border: none;
  text-align: left;
  cursor: pointer;
  transition: transform 150ms cubic-bezier(0.22, 1, 0.36, 1);
}

.template-item:hover {
  transform: translateY(-2px);
}

.template-item:active {
  transform: translateY(0);
}
</style>
