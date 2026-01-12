<script setup lang="ts">
import type { Ref } from 'vue'
import type { GlobalDebugResponse } from '../composables/fetch'
import {
  RadioGroup,
  RadioGroupLabel,
  RadioGroupOption,
} from '@headlessui/vue'
import { ref } from 'vue'
import { fetchGlobalDebug } from '../composables/fetch'
import { CreateOgImageDialogPromise } from '../composables/templates'

function handleClose(_a: unknown, resolve: (value: string | false) => void) {
  resolve(false)
}

const { data: globalDebug } = await fetchGlobalDebug() as { data: Ref<GlobalDebugResponse | null> }

const component = ref(globalDebug.value?.runtimeConfig?.componentDirs?.[0])
</script>

<template>
  <CreateOgImageDialogPromise v-slot="{ resolve, args }">
    <div my-10>
      <NDialog :model-value="true" style="max-height: 80vh;" @update:model-value="handleClose('a', resolve)" @close="handleClose('b', resolve)">
        <div flex="~ col gap-2" w-200 p4 border="t base">
          <h2 text-xl class="text-primary">
            Eject Component
          </h2>

          <p>Copy a community template to a OG Image component directory in your project. You can configure directories using <span class="opacity-50">componentDirs</span> in nuxt.config.</p>

          <RadioGroup v-model="component">
            <div class="mb-3 mt-6 font-medium text-sm">
              <RadioGroupLabel>Choose Output Path</RadioGroupLabel>
            </div>
            <div class="space-y-2">
              <RadioGroupOption
                v-for="dir in globalDebug?.runtimeConfig?.componentDirs"
                :key="dir"
                v-slot="{ active, checked }"
                as="template"
                :value="dir"
              >
                <div
                  :class="[
                    active
                      ? 'ring-2 ring-white/60 ring-offset-2 ring-offset-sky-300'
                      : '',
                    checked ? 'bg-sky-700/75 text-white ' : 'bg-white ',
                  ]"
                  class="relative flex cursor-pointer rounded-lg px-5 py-4 shadow-md focus:outline-none"
                >
                  <div class="flex w-full items-center justify-between">
                    <div class="flex items-center">
                      <div class="text-sm">
                        <RadioGroupLabel
                          as="p"
                          :class="checked ? 'text-white' : 'text-gray-900'"
                          class="font-medium"
                        >
                          ./components/{{ dir }}/{{ args[0] }}.vue
                        </RadioGroupLabel>
                      </div>
                    </div>
                    <div v-show="checked" class="shrink-0 text-white">
                      <svg class="h-6 w-6" viewBox="0 0 24 24" fill="none">
                        <circle
                          cx="12"
                          cy="12"
                          r="12"
                          fill="#fff"
                          fill-opacity="0.2"
                        />
                        <path
                          d="M7 13l3 3 7-7"
                          stroke="#fff"
                          stroke-width="1.5"
                          stroke-linecap="round"
                          stroke-linejoin="round"
                        />
                      </svg>
                    </div>
                  </div>
                </div>
              </RadioGroupOption>
            </div>
          </RadioGroup>

          <div flex="~ gap-3" mt2 justify-end>
            <NButton @click="resolve(false)">
              Cancel
            </NButton>
            <NButton n="solid" capitalize class="n-blue px-3 py-1.5 rounded" @click="resolve(component || false)">
              Create Component
            </NButton>
          </div>
        </div>
      </NDialog>
    </div>
  </CreateOgImageDialogPromise>
</template>
