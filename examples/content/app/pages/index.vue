<script lang="ts" setup>
defineOgImage('BlogPost', {
  title: 'My Blog',
  description: 'OG images powered by @nuxt/content',
})

const { data: posts } = await useAsyncData('blog', () =>
  queryCollection('blog').all())
</script>

<template>
  <div>
    <h1>Blog</h1>
    <ul>
      <li v-for="post in posts" :key="post.path">
        <NuxtLink :to="post.path">
          {{ post.title }}
        </NuxtLink>
      </li>
    </ul>
  </div>
</template>
