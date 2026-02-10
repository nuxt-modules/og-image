<template>
  <div class="flex items-center justify-center w-full h-full bg-white">
    <div class="flex flex-col items-center">
      <h1 class="text-4xl mb-8">
        Inline SVG Test
      </h1>
      <!-- Inline SVG -->
      <svg width="100" height="100" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="50" cy="50" r="40" stroke="black" stroke-width="3" fill="red" />
      </svg>
      <p class="mt-4">
        This circle should be red
      </p>

      <!-- SVG as background image -->
      <div
        class="mt-8 w-24 h-24 border border-gray-300"
        :style="{
          backgroundImage: `url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgdmlld0JveD0iMCAwIDEwMCAxMDAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGNpcmNsZSBjeD0iNTAiIGN5PSI1MCIgcj0iNDAiIHN0cm9rZT0iYmxhY2siIHN0cm9rZS13aWR0aD0iMyIgZmlsbD0iYmx1ZSIgLz48L3N2Zz4=')`,
          backgroundSize: 'contain',
          backgroundRepeat: 'no-repeat',
        }"
      />
      <p class="mt-4">
        This box should have a blue circle background
      </p>
    </div>
  </div>
</template>
