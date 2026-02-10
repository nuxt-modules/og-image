<template>
  <div class="flex flex-col items-center justify-center w-full h-full bg-slate-900 text-white p-20">
    <h1 class="text-5xl font-bold mb-12">
      Takumi SVG Features
    </h1>

    <div class="grid grid-cols-2 gap-12">
      <!-- Native SVG (no rasterization) -->
      <div class="flex flex-col items-center">
        <svg
          width="120" height="120" viewBox="0 0 100 100"
          data-takumi-native
          class="border border-slate-700 p-2"
        >
          <defs>
            <linearGradient id="grad1" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" style="stop-color:rgb(255,255,0);stop-opacity:1" />
              <stop offset="100%" style="stop-color:rgb(255,0,0);stop-opacity:1" />
            </linearGradient>
          </defs>
          <ellipse cx="50" cy="50" rx="40" ry="40" fill="url(#grad1)" />
        </svg>
        <span class="mt-4 text-slate-400">Native SVG (data-takumi-native)</span>
      </div>

      <!-- Rasterized SVG (default) -->
      <div class="flex flex-col items-center">
        <svg
          width="120" height="120" viewBox="0 0 100 100"
          class="border border-slate-700 p-2"
        >
          <circle cx="50" cy="50" r="40" stroke="green" stroke-width="4" fill="yellow" />
        </svg>
        <span class="mt-4 text-slate-400">Rasterized SVG (PNG)</span>
      </div>

      <!-- SVG as Background Image (External) -->
      <div class="flex flex-col items-center">
        <div
          class="w-32 h-32 border border-slate-700"
          style="background-image: url('/card-gradient-bg.svg'); background-size: contain; background-repeat: no-repeat;"
        />
        <span class="mt-4 text-slate-400">External SVG Background</span>
      </div>

      <!-- SVG as Background Image (Data URI) -->
      <div class="flex flex-col items-center">
        <div
          class="w-32 h-32 border border-slate-700"
          style="background-image: url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgdmlld0JveD0iMCAwIDEwMCAxMDAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PHJlY3Qgd2lkdGg9IjEwMCIgaGVpZ2h0PSIxMDAiIGZpbGw9InB1cnBsZSIvPjwvc3ZnPg=='); background-size: cover;"
        />
        <span class="mt-4 text-slate-400">Data URI SVG Background</span>
      </div>
    </div>
  </div>
</template>
