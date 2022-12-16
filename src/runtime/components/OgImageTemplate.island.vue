<script setup lang="ts">
const props = defineProps({
  path: String,
  title: String,
  description: String,
})
</script>

<template>
  <div class="wrap">
    <div class="bg1" />
    <div class="bg2" />
    <div>
      <p>This is the default og:image template from <a href="https://github.com/harlan-zw/nuxt-og-image" target="_blank">nuxt-og-image</a>.</p>
      <p>Create your own at <code>components/islands/OgImageTemplate.vue</code>.</p>
    </div>
    <div>
      <strong>Payload</strong>
      <code>
        <pre>{{ props }}</pre>
      </code>
    </div>
  </div>
</template>

<style scoped>
.wrap {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  flex-direction: column;
  color: white;
  font-weight: bold;
  font-family: sans-serif;
  background-color: #0c0c0c;
  position: relative;
}

.bg1 {
  top: 0;
  left: 0;
  display: block;
  position: absolute;
  width: 100%;
  height: 100%;
  padding: 0 !important;
  margin: 0 !important;
  background-color: #0c0c0c;
}

.bg2 {
  top: 0;
  left: 0;
  z-index: 1;
  display: block;
  position: absolute;
  width: 100%;
  height: 100%;
  padding: 0 !important;
  margin: 0 !important;
  background: radial-gradient(at 100% 100%, #0f766e, rgba(12, 12, 12, 0.1) 60%);
}

a {
  color: inherit;
  padding-bottom: 3px;
  text-decoration: none;
  border-bottom: 3px solid #ff8235;
}

.wrap > div {
  z-index: 2;
  padding: 2rem;
}

code pre {
  background: #333;
  color: white;
  padding: 1rem;
  border-radius: 0.5rem;
  font-weight: lighter;
  font-size: 1.1rem;
}

p {
  font-size: 1.5em;
  font-weight: normal;
}

h1 {
  font-size: 4rem;
  margin: 0;
}
</style>
