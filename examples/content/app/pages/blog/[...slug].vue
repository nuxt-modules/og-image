<script lang="ts" setup>
const route = useRoute()

const { data: post } = await useAsyncData(`blog-${route.path}`, () =>
  queryCollection('blog').path(route.path).first())

defineOgImage('BlogPost', {
  title: post.value?.title,
  description: post.value?.description,
})
</script>

<template>
  <div v-if="post">
    <h1>{{ post.title }}</h1>
    <p>{{ post.description }}</p>
    <ContentRenderer :value="post" />
  </div>
</template>
