<template>
  <div>
    <header>
      <nav>
        <ul>
          <li>
            <NuxtLink to="/">
              Home
            </NuxtLink>
          </li>
          <li>
            <NuxtLink to="/no-i18n">
              No I18n
            </NuxtLink>
          </li>
        </ul>
      </nav>
    </header>
    <div>Welcome to the OG Image basic demo.</div>
    <div>Open the Nuxt DevTools OG Image tab (ctrl+alt+d) to get started.</div>
    <NuxtPage />
  </div>
</template>
