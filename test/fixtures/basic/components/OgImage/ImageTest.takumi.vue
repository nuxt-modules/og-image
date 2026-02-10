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
        <div class="flex flex-col items-center">
          <img src="https://placehold.co/100x100" width="100" height="100">
          <span class="text-sm">100x100</span>
        </div>
        <div class="flex flex-col items-center">
          <svg
            class="w-[100px] h-[100px]"
            width="100"
            height="100"
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
          >
            <!-- Icon from Solar by 480 Design - https://creativecommons.org/licenses/by/4.0/ -->
            <path
              fill="white"
              fill-rule="evenodd"
              d="M12.02 14.937c-.292 0-.59.045-.842.143a1.3 1.3 0 0 0-.408.245a.92.92 0 0 0-.307.675c0 .325.173.552.307.674c.133.123.285.198.408.246c.253.098.55.142.842.142c.29 0 .588-.044.84-.142c.125-.048.276-.123.41-.246a.92.92 0 0 0 .306-.674a.92.92 0 0 0-.307-.675a1.3 1.3 0 0 0-.408-.245a2.4 2.4 0 0 0-.841-.143"
              clip-rule="evenodd"
            />
            <path
              fill="white"
              d="M14.037 12.646c.164-.266.49-.584.98-.584c.488 0 .814.318.979.584c.172.278.254.615.254.948s-.082.67-.254.947c-.165.266-.49.584-.98.584c-.489 0-.815-.318-.98-.584a1.8 1.8 0 0 1-.254-.947c0-.333.082-.67.255-.948m-5.021-.583c-.488 0-.814.317-.98.583a1.8 1.8 0 0 0-.254.948c0 .332.082.67.255.947c.165.266.49.584.98.584c.488 0 .814-.318.98-.584c.171-.278.253-.615.253-.947c0-.333-.082-.67-.254-.948c-.165-.266-.49-.584-.98-.584"
            />
            <path
              fill="white"
              fill-rule="evenodd"
              d="M6.095 4.25c-.614 0-1.32.179-1.886.666c-.587.505-.939 1.272-.939 2.271v1.878c.001.294.051.883.219 1.374c.055.161.142.374.289.567a4.9 4.9 0 0 0-.48 1.704c-.051.467-.052.958-.044 1.411c-.66.23-1.345.514-1.66.718a.75.75 0 0 0 .813 1.26c.116-.075.46-.233.912-.405c.069.479.208.915.403 1.312a21 21 0 0 0-.516.333a.75.75 0 1 0 .814 1.26l.131-.086c.131-.085.282-.184.446-.284c.59.602 1.322 1.067 2.082 1.417c1.781.82 3.89 1.104 5.321 1.104s3.54-.285 5.321-1.104c.76-.35 1.493-.815 2.082-1.417c.164.1.315.199.446.284l.131.086a.75.75 0 0 0 .814-1.26l-.113-.074c-.11-.072-.247-.162-.403-.259c.195-.396.335-.833.404-1.312c.452.172.795.33.912.405a.75.75 0 0 0 .813-1.26c-.315-.204-1-.488-1.661-.718a11 11 0 0 0-.044-1.412a4.9 4.9 0 0 0-.48-1.703c.147-.193.234-.406.29-.567a4.8 4.8 0 0 0 .218-1.374V7.188c0-1-.352-1.766-.939-2.272c-.565-.487-1.272-.666-1.886-.666c-.408 0-.83.157-1.171.31a13 13 0 0 0-1.078.571l-.213.123l-.002.001c-.264.153-.498.29-.707.397q-.194.099-.306.14l-.062.02a5 5 0 0 1-.648-.052l-.162-.02A12 12 0 0 0 12 5.656c-.772 0-1.21.041-1.556.084l-.162.02a5 5 0 0 1-.648.052l-.062-.02a3 3 0 0 1-.306-.14a17 17 0 0 1-.707-.397l-.215-.124a13 13 0 0 0-1.077-.57c-.341-.154-.764-.311-1.172-.311m.067 13.364c.334.252.719.474 1.144.67c1.53.704 3.412.966 4.694.966s3.163-.262 4.694-.966c.425-.196.81-.418 1.144-.67a.75.75 0 0 1 .13-1.489c.327 0 .662.082.972.195a3 3 0 0 0 .283-1.093a3 3 0 0 0-.61-.102a.75.75 0 0 1 0-1.5c.195 0 .415.03.637.072c0-.276-.009-.547-.039-.825c-.07-.645-.253-1.218-.684-1.727a3.4 3.4 0 0 0-.587-.54a.75.75 0 1 1 .888-1.21q.18.132.338.27c.044-.228.064-.467.064-.604V7.188c0-.626-.206-.953-.418-1.135c-.232-.2-.562-.303-.907-.303c-.07 0-.246.039-.554.178c-.287.13-.608.308-.947.503l-.193.112c-.268.155-.545.316-.79.442c-.155.08-.316.156-.471.214a1.6 1.6 0 0 1-.556.114a6 6 0 0 1-.883-.067l-.137-.017A10 10 0 0 0 12 7.156c-.708 0-1.085.037-1.373.073l-.138.017c-.25.033-.511.066-.883.066c-.213 0-.412-.06-.555-.113a4 4 0 0 1-.472-.214c-.245-.126-.522-.287-.79-.442l-.193-.112c-.339-.195-.66-.374-.947-.503c-.308-.14-.484-.178-.554-.178c-.344 0-.675.103-.907.303c-.212.182-.418.51-.418 1.135V9.06c0 .137.02.376.064.604q.16-.138.338-.27a.75.75 0 0 1 .888 1.21q-.358.265-.587.54c-.43.51-.614 1.082-.684 1.727c-.03.278-.04.55-.04.825c.223-.043.443-.072.638-.072a.75.75 0 0 1 0 1.5c-.106 0-.312.03-.61.102c.027.398.125.761.283 1.093a2.9 2.9 0 0 1 .972-.195a.75.75 0 0 1 .13 1.489"
              clip-rule="evenodd"
            />
          </svg>
          <span class="text-sm">Solar SVG</span>
        </div>
      </div>
    </div>
  </div>
</template>
