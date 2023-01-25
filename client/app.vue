<script lang="ts" setup>
import { containerWidth, path, refreshSources, rpc } from './util/logic'

useHead({
  title: 'OG Image Playground',
})

path.value = useRoute().query.path as string || '/'

const config = await rpc.useServerConfig()
const options = await fetchOptions()
</script>

<template>
  <div class="flex-row flex h-screen">
    <header class="border-r-1 border-light-400 dark:(border-dark-400 bg-dark-900 text-light) bg-white text-dark-800 flex flex-col justify-between h-screen z-5">
      <div class="flex-grow">
        <div class="py-5 w-full flex items-start px-5 justify-between space-x-5">
          <h1 class="text-base hidden md:block">
            <div>OG Image Playground</div>
          </h1>
          <NDarkToggle>
            <template #default="{ toggle }">
              <NButton n="borderless lg m-0" p-0 op50 @click="toggle">
                <NIcon icon="dark:carbon-moon carbon-sun" />
              </NButton>
            </template>
          </NDarkToggle>
        </div>
        <hr class="border-1 border-light-400 dark:border-dark-400">
        <div class="py-7 px-5 text-sm flex flex-col space-y-3">
          <NuxtLink v-slot="{ isActive }" to="/" class="transition-all hover:(ml-1)">
            <Icon name="carbon:image-search" class="mr-1" :class="[isActive ? 'opacity-90' : 'opacity-60']" />
            <span :class="[isActive ? 'underline' : 'opacity-60']">
              Preview
            </span>
          </NuxtLink>
          <NuxtLink v-slot="{ isActive }" to="/options" class="transition-all hover:(ml-1)">
            <Icon name="carbon:operations-record" class="mr-1" :class="[isActive ? 'opacity-90' : 'opacity-60']" />
            <span :class="[isActive ? 'underline' : 'opacity-60']">
              Options
            </span>
          </NuxtLink>
          <NuxtLink v-slot="{ isActive }" to="/vnodes" class="transition-all hover:(ml-1)">
            <Icon name="carbon:ibm-cloud-pak-manta-automated-data-lineage" class="mr-1" :class="[isActive ? 'opacity-90' : 'opacity-60']" />
            <span :class="[isActive ? 'underline' : 'opacity-60']">
              vNodes
            </span>
          </NuxtLink>
        </div>
        <hr class="border-1 border-light-400 dark:border-dark-400">
        <div v-if="useRoute().path === '/'" class="py-7 px-5 text-sm flex flex-col space-y-3">
          <div>
            <NButton v-if="containerWidth !== 504" @click="containerWidth = 504">
              Small
            </NButton>
            <NButton v-if="containerWidth !== null" @click="containerWidth = null">
              Full width
            </NButton>
          </div>
        </div>
      </div>
      <hr class="border-1 2xl:block hidden border-light-400 dark:border-dark-400">
      <div class="py-7 px-5  2xl:(block space-y-4 space-x-0) space-x-6 hidden justify-center">
        <nav class="text-sm hidden 2xl:block" role="navigation">
          <ul class="mb-5">
            <li class="mb-2">
              <a href="https://github.com/harlan-zw/nuxt-og-image" target="_blank">Docs</a>
            </li>
            <li>
              <a href="https://github.com/sponsors/harlan-zw">Sponsor</a>
            </li>
          </ul>
          <a class="hidden 2xl:flex items-center" href="https://harlanzw.com" title="View Harlan's site." target="_blank">
            <div class="flex items-center">
              <img src="https://avatars.githubusercontent.com/u/5326365?v=4" class="rounded-full h-7 w-7 mr-2">
              <div class="flex flex-col">
                <span class="opacity-60 text-xs">Created by</span>
                <h1 class="text-sm opacity-80">harlanzw</h1>
              </div>
            </div>
          </a>
        </nav>
      </div>
    </header>
    <main class="mx-auto flex-1 w-full bg-white dark:bg-black max-h-screen overflow-hidden">
      <div class="py-9px dark:(bg-dark-800) bg-light-200 px-10 opacity-80 flex justify-center items-center block space-x-10">
        <div class="text-sm">
          <div class="text-xs opacity-40">
            Path
          </div>
          <div class="flex items-center space-x-1">
            <NTextInput v-model="path" placeholder="Search..." n="primary" @input="refreshSources" />
          </div>
        </div>
        <div class="text-sm">
          <div class="text-xs opacity-40  mb-1">
            Provider
          </div>
          <div class="flex items-center space-x-1">
            <span :class="options.provider === 'satori' ? 'logos-vercel-icon' : 'logos-chrome'" />
            <span>{{ options.provider === 'satori' ? 'Satori' : 'Browser' }}</span>
          </div>
        </div>
        <div v-if="options.component" class="text-sm">
          <div class="text-xs opacity-40  mb-1">
            Component
          </div>
          <div class="flex items-center space-x-1">
            <span class="logos-vue" />
            <span>{{ options.component }}.vue</span>
          </div>
        </div>
      </div>
      <hr class="border-1 border-light-400 dark:border-dark-400">
      <div class="h-full max-h-full overflow-auto dark:bg-dark-700 bg-light-200">
        <NuxtPage />
      </div>
      <footer class="block 2xl:hidden space-x-5 flex justify-center items-center">
        <ul class="flex space-x-5">
          <li class="mb-2">
            <a href="https://github.com/harlan-zw/nuxt-og-image" target="_blank">Docs</a>
          </li>
          <li>
            <a href="https://github.com/sponsors/harlan-zw">Sponsor</a>
          </li>
        </ul>
        <a class="flex items-center" href="https://harlanzw.com" title="View Harlan's site." target="_blank">
          <div class="flex items-center">
            <img src="https://avatars.githubusercontent.com/u/5326365?v=4" class="rounded-full h-7 w-7 mr-2">
            <div class="flex flex-col">
              <span class="opacity-60 text-xs">Created by</span>
              <h1 class="text-sm opacity-80">harlanzw</h1>
            </div>
          </div>
        </a>
      </footer>
    </main>
  </div>
</template>

<style>
.tab-panels {
  width: 100%;
}
div[role="tabpanel"] {
  width: 100%;
  display: flex;
}
</style>
