<script setup lang="ts">
import type { Ref } from 'vue'
import type { GlobalDebugResponse } from '../composables/fetch'
import { inject } from '#imports'
import { computed, ref, watch } from 'vue'
import { GlobalDebugKey } from '../composables/keys'
import { CreateOgImageDialogPromise } from '../composables/templates'

function handleClose(_a: unknown, resolve: (value: string | false) => void) {
  resolve(false)
}

const globalDebug = inject(GlobalDebugKey) as Ref<GlobalDebugResponse | null>

const componentDirs = computed(() => globalDebug.value?.runtimeConfig?.componentDirs || [])
const selected = ref(componentDirs.value[0])
watch(componentDirs, (dirs) => {
  if (!selected.value && dirs.length > 0)
    selected.value = dirs[0]
})
</script>

<template>
  <CreateOgImageDialogPromise v-slot="{ resolve, args }">
    <UModal
      :open="true"
      title="Eject Component"
      description="Copy a community template to an OG Image component directory in your project. You can configure directories using componentDirs in nuxt.config."
      @update:open="handleClose('a', resolve)"
      @close="handleClose('b', resolve)"
    >
      <template #body>
        <URadioGroup
          v-model="selected"
          :items="componentDirs.map((dir: string) => ({
            label: `./components/${dir}/${args[0]}.vue`,
            value: dir,
          }))"
          variant="card"
          legend="Choose Output Path"
        />
      </template>

      <template #footer>
        <div class="flex justify-end gap-3">
          <UButton variant="ghost" color="neutral" @click="resolve(false)">
            Cancel
          </UButton>
          <UButton color="primary" @click="resolve(selected || false)">
            Create Component
          </UButton>
        </div>
      </template>
    </UModal>
  </CreateOgImageDialogPromise>
</template>
