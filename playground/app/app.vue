<template>
  <UApp>
    <header class="sticky top-0 z-50 w-full backdrop-blur border-b border-(--ui-border) bg-(--ui-bg)/75">
      <UContainer class="py-3 flex items-center justify-between">
        <NuxtLink to="/" class="flex items-center gap-1.5 font-bold text-xl">
          <UIcon name="logos:nuxt-icon" class="size-8" />
          Nuxt
          <span class="text-(--ui-primary)">OG Image</span>
        </NuxtLink>

        <UColorModeButton />
      </UContainer>
    </header>

    <main class="flex-1">
      <UContainer class="py-6">
        <NuxtPage />
      </UContainer>
    </main>

    <footer class="border-t border-(--ui-border)">
      <UContainer class="py-4 flex justify-center items-center gap-1.5 text-sm text-(--ui-text-muted)">
        Made by
        <UAvatar src="https://avatars.githubusercontent.com/u/5326365?v=4" size="xs" />
        Harlan Wilton
      </UContainer>
    </footer>
  </UApp>
</template>
