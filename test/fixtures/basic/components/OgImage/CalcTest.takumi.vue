<script setup lang="ts">
</script>

<template>
  <div class="w-full h-full flex items-center justify-center bg-gray-900 text-white">
    <div class="flex flex-col items-center gap-4">
      <h1 class="text-6xl font-bold">
        Calc Test
      </h1>

      <!-- inline: multiply -->
      <div style="width: calc(200px * 1.5); height: 40px; background-color: #3b82f6; display: flex; align-items: center; justify-content: center;">
        inline *
      </div>

      <!-- inline: add -->
      <div style="width: calc(80px + 120px); height: 40px; background-color: #22c55e; display: flex; align-items: center; justify-content: center;">
        inline +
      </div>

      <!-- inline: subtract -->
      <div style="width: calc(300px - 100px); height: 40px; background-color: #eab308; display: flex; align-items: center; justify-content: center;">
        inline -
      </div>

      <!-- inline: divide -->
      <div style="width: calc(400px / 2); height: 40px; background-color: #a855f7; display: flex; align-items: center; justify-content: center;">
        inline /
      </div>

      <!-- inline: nested calc -->
      <div style="width: calc(calc(100px * 2) + 50px); height: 40px; background-color: #f97316; display: flex; align-items: center; justify-content: center;">
        nested
      </div>

      <!-- unscoped style block -->
      <div class="unscoped-calc">
        style block
      </div>

      <!-- scoped style block -->
      <div class="scoped-calc">
        scoped block
      </div>

      <!-- tw rounded-full (calc(infinity * 1px)) -->
      <div class="rounded-full" style="width: 60px; height: 60px; background-color: #ec4899; display: flex; align-items: center; justify-content: center;">
        pill
      </div>
    </div>
  </div>
</template>

<style>
.unscoped-calc {
  width: calc(100px * 2);
  height: 40px;
  background-color: #ef4444;
  display: flex;
  align-items: center;
  justify-content: center;
}
</style>

<style scoped>
.scoped-calc {
  width: calc(150px + 50px);
  height: 40px;
  background-color: #06b6d4;
  display: flex;
  align-items: center;
  justify-content: center;
}
</style>
