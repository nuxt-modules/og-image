<script setup lang="ts">
const rows = [
  { name: 'dist', depth: 0, type: 'dir' },
  { name: 'index.cjs', depth: 1, type: 'file' },
  { name: 'index.d.ts', depth: 1, type: 'file' },
  { name: 'index.mjs', depth: 1, type: 'file' },
  { name: 'helpers', depth: 1, type: 'dir' },
  { name: 'css-property.d.ts', depth: 2, type: 'file' },
  { name: 'css-property.mjs', depth: 2, type: 'file' },
  { name: 'css-property.cjs', depth: 2, type: 'file' },
  { name: 'css-layout.d.ts', depth: 2, type: 'file' },
  { name: 'css-layout.mjs', depth: 2, type: 'file' },
  { name: 'css-layout.cjs', depth: 2, type: 'file' },
  { name: 'generated', depth: 2, type: 'dir' },
  { name: 'long-generated-types.d.ts', depth: 3, type: 'file' },
  { name: 'style-resolver.generated.mjs', depth: 3, type: 'file' },
]
</script>

<template>
  <div class="relative w-full h-full overflow-hidden bg-surface text-white">
    <div class="absolute left-12 top-10 bottom-10 w-[650px] flex flex-col justify-center">
      <div class="flex items-center gap-3">
        <span class="i-carbon:download text-brand shrink-0" style="width: 32px; height: 32px" />
        <p class="text-brand font-bold text-[34px] m-0">
          takumi-js
        </p>
      </div>
      <h1 class="text-[76px] leading-[1.05] font-bold m-0">
        Source code tree
      </h1>
      <p class="text-[30px] leading-10 text-accent m-0">
        Nested dist/helpers tree with custom Uno positioning.
      </p>
    </div>

    <div class="absolute force-right-8 top-8 bottom-8 w-[340px] flex flex-col gap-0 overflow-hidden opacity-70 font-mono text-[18px] leading-8 text-white">
      <div
        v-for="row in rows"
        :key="`${row.depth}-${row.name}`"
        class="flex items-center whitespace-nowrap shrink-0"
        :style="{ paddingLeft: `${row.depth * 24}px` }"
      >
        <span class="w-5 text-brand">{{ row.type === 'dir' ? '+' : '-' }}</span>
        <span>{{ row.name }}</span>
      </div>
    </div>
  </div>
</template>
