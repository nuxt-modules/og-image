<script setup lang="ts">
import { useVModel } from '@vueuse/core'

const props = withDefaults(
  defineProps<{
    icon?: string
    text?: string
    description?: string
    containerClass?: string
    headerClass?: string
    collapse?: boolean
    open?: boolean
    padding?: boolean | string
  }>(),
  {
    containerClass: '',
    open: true,
    padding: true,
    collapse: true,
  },
)

const open = useVModel(props, 'open')
function onToggle(e: any) {
  open.value = e.target.open
}
</script>

<template>
  <details :open="open" class="section-block" @toggle="onToggle">
    <summary class="section-header" :class="collapse ? '' : 'pointer-events-none'">
      <NIconTitle :icon="icon" :text="text" text-xl transition :class="[open ? 'op100' : 'op60', headerClass]">
        <div>
          <div class="text-sm font-medium">
            <slot name="text">
              {{ text }}
            </slot>
          </div>
          <div v-if="description || $slots.description" class="text-xs opacity-50 mt-0.5">
            <slot name="description">
              {{ description }}
            </slot>
          </div>
        </div>
        <div class="flex-auto" />
        <slot name="actions" />
        <NIcon
          v-if="collapse"
          icon="carbon-chevron-down"
          class="chevron text-sm opacity-50"
          cursor-pointer place-self-start transition duration-300
        />
      </NIconTitle>
    </summary>
    <div
      class="section-content"
      :class="typeof padding === 'string' ? padding : padding ? 'px-4' : ''"
    >
      <slot name="details" />
      <div :class="containerClass">
        <slot />
      </div>
      <slot name="footer" />
    </div>
  </details>
  <div class="section-divider" />
</template>

<style scoped>
.section-block {
  border: none;
  border-radius: 8px;
  overflow: hidden;
}

.section-header {
  cursor: pointer;
  user-select: none;
  padding: 12px 16px;
  border-radius: 8px;
  transition: all 0.15s ease;
  background: oklch(98.4% 0.003 285);
  list-style: none;
}

.dark .section-header {
  background: oklch(20.8% 0.042 285);
}

.section-header:hover {
  background: oklch(96.8% 0.007 285);
}

.dark .section-header:hover {
  background: oklch(24% 0.042 285);
}

details[open] .section-header {
  border-radius: 8px 8px 0 0;
}

details summary::-webkit-details-marker {
  display: none;
}

details[open] .chevron {
  transform: rotate(180deg);
  opacity: 0.75;
}

.section-content {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 12px 16px 16px;
  background: oklch(99% 0.002 285);
  border-radius: 0 0 8px 8px;
}

.dark .section-content {
  background: oklch(17% 0.042 285);
}

.section-divider {
  height: 1px;
  margin: 8px 0;
  background: transparent;
}
</style>
