<script setup lang="ts">
defineProps<{
  title?: string
}>()
</script>

<template>
  <div class="w-full h-full flex flex-col bg-gray-900 p-6">
    <!-- Header with title -->
    <div class="flex items-center justify-between mb-4">
      <h1 class="text-3xl font-bold text-white">
        {{ title || 'Nuxt UI Components' }}
      </h1>
      <div class="flex gap-2">
        <UBadge color="primary" variant="solid">
          Primary
        </UBadge>
        <UBadge color="success" variant="solid">
          Success
        </UBadge>
        <UBadge color="warning" variant="outline">
          Warning
        </UBadge>
      </div>
    </div>

    <!-- Main content -->
    <div class="flex gap-4 flex-1">
      <!-- Left: Card with buttons -->
      <UCard class="flex-1">
        <template #header>
          <div class="flex items-center gap-2">
            <UAvatar text="NU" color="primary" size="md" />
            <span class="font-semibold text-white">Nuxt UI</span>
          </div>
        </template>

        <div class="flex flex-col gap-3">
          <UButton color="primary" variant="solid" block>
            Primary Button
          </UButton>
          <UButton color="secondary" variant="soft" block>
            Secondary Soft
          </UButton>
          <UButton color="error" variant="outline" block>
            Error Outline
          </UButton>
        </div>

        <template #footer>
          <div class="flex items-center gap-2 text-gray-400 text-sm">
            <span>Press</span>
            <UKbd>⌘</UKbd>
            <UKbd>K</UKbd>
            <span>to search</span>
          </div>
        </template>
      </UCard>

      <!-- Right: Stats -->
      <div class="flex-1 flex flex-col gap-3">
        <div class="bg-gray-800 rounded-lg p-4">
          <div class="text-gray-400 text-sm">
            Downloads
          </div>
          <div class="text-2xl font-bold text-primary">
            1.2M
          </div>
        </div>
        <div class="bg-gray-800 rounded-lg p-4">
          <div class="text-gray-400 text-sm">
            Stars
          </div>
          <div class="text-2xl font-bold text-success">
            4.5K
          </div>
        </div>
        <div class="bg-gray-800 rounded-lg p-4">
          <div class="text-gray-400 text-sm">
            Contributors
          </div>
          <div class="text-2xl font-bold text-warning">
            89
          </div>
        </div>
      </div>
    </div>

    <!-- Footer -->
    <div class="mt-4 flex items-center justify-between text-gray-500 text-sm">
      <span>Built with Nuxt UI v3</span>
      <div class="flex items-center gap-2">
        <UBadge color="info" size="xs">
          Vue 3
        </UBadge>
        <UBadge color="neutral" size="xs">
          TypeScript
        </UBadge>
      </div>
    </div>
  </div>
</template>
