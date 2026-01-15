<script setup lang="ts">
defineOgImage({
  component: 'NuxtSeo',
  props: {
    title: 'Default @nuxt/fonts Test',
    description: 'Testing default font resolution',
  },
})
</script>

<template>
  <div>
    <h1>@nuxt/fonts Integration Test</h1>
    <p>Default page - uses NuxtSeo component with Inter from @nuxt/fonts</p>
    <nav>
      <ul>
        <li>
          <NuxtLink to="/inline-font">
            Inline Font Test
          </NuxtLink>
        </li>
      </ul>
    </nav>
  </div>
</template>
