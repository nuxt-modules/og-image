<script setup lang="ts">
import type { AddComponentResult } from '../composables/templates'
import { computed, ref, watch } from 'vue'
import { AddComponentDialogPromise } from '../composables/templates'

function handleClose(_a: unknown, resolve: (value: AddComponentResult | false) => void) {
  resolve(false)
}

const componentName = ref('')
const nameError = ref('')

function validateName(value: string): string {
  if (!value.trim())
    return 'Name is required'
  if (!/^\w+$/.test(value.trim()))
    return 'Only letters, numbers, and underscores allowed'
  return ''
}

watch(componentName, (v) => {
  nameError.value = v ? validateName(v) : ''
})

const previewName = computed(() => {
  const name = componentName.value.trim()
  if (!name)
    return ''
  return name.charAt(0).toUpperCase() + name.slice(1)
})

function submit(resolve: (value: AddComponentResult | false) => void) {
  const name = componentName.value.trim()
  const error = validateName(name)
  if (error) {
    nameError.value = error
    return
  }
  resolve({ name: name.charAt(0).toUpperCase() + name.slice(1) })
  componentName.value = ''
  nameError.value = ''
}
</script>

<template>
  <AddComponentDialogPromise v-slot="{ resolve }">
    <UModal
      :open="true"
      title="Create OG Image Component"
      @update:open="handleClose('a', resolve)"
      @close="handleClose('b', resolve)"
    >
      <template #body>
        <div class="flex flex-col gap-4">
          <UFormField label="Component Name" :error="nameError" hint="Auto-capitalized to PascalCase">
            <UInput
              v-model="componentName"
              placeholder="MyOgImage"
              autofocus
              class="w-full"
              @keydown.enter="submit(resolve)"
            />
          </UFormField>

          <div v-if="previewName" class="text-xs text-[var(--color-text-subtle)] font-mono bg-[var(--color-surface-sunken)] rounded-lg px-3 py-2">
            defineOgImage('{{ previewName }}')
          </div>
        </div>
      </template>

      <template #footer>
        <div class="flex justify-end gap-3">
          <UButton variant="ghost" color="neutral" @click="resolve(false)">
            Cancel
          </UButton>
          <UButton color="primary" :disabled="!componentName.trim() || !!nameError" @click="submit(resolve)">
            Create
          </UButton>
        </div>
      </template>
    </UModal>
  </AddComponentDialogPromise>
</template>
