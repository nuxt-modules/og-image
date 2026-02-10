<script setup lang="ts">
</script>

<template>
  <div class="w-full h-full flex items-center justify-center bg-gray-900 text-white">
    <div class="flex flex-col items-center gap-4">
      <h1 class="text-4xl font-bold">
        Image Test
      </h1>
      <div class="flex flex-row gap-4 items-end">
        <!-- Remote URL via img src -->
        <div class="flex flex-col items-center">
          <img src="https://placehold.co/80x80/orange/white" width="80" height="80">
          <span class="text-sm">img src</span>
        </div>
        <!-- Data URI via img src -->
        <div class="flex flex-col items-center">
          <img src="data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI4MCIgaGVpZ2h0PSI4MCIgdmlld0JveD0iMCAwIDgwIDgwIj48cmVjdCB3aWR0aD0iODAiIGhlaWdodD0iODAiIGZpbGw9IiM2MzY2ZjEiLz48dGV4dCB4PSI1MCUiIHk9IjUwJSIgZmlsbD0id2hpdGUiIGZvbnQtc2l6ZT0iMTQiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGRvbWluYW50LWJhc2VsaW5lPSJjZW50cmFsIj5TVkc8L3RleHQ+PC9zdmc+" width="80" height="80">
          <span class="text-sm">data URI</span>
        </div>
        <!-- CSS background-image with remote URL -->
        <div class="flex flex-col items-center">
          <div style="background-image: url('https://placehold.co/80x80/22c55e/white'); width: 80px; height: 80px; background-size: cover;" />
          <span class="text-sm">bg-image</span>
        </div>
        <!-- Local public asset via img src -->
        <div class="flex flex-col items-center">
          <img src="/assets/static/images/og.jpg" width="80" height="80" style="object-fit: cover;">
          <span class="text-sm">local</span>
        </div>
        <!-- Simple Red SVG -->
        <div class="flex flex-col items-center">
          <svg width="80" height="80" xmlns="http://www.w3.org/2000/svg"><rect width="80" height="80" fill="red" /></svg>
          <span class="text-sm">svg</span>
        </div>
      </div>
    </div>
  </div>
</template>
