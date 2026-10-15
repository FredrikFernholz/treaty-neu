<script setup lang="ts">
// Rahmen der Anwendung. Die jeweilige Seite erscheint an der Stelle von RouterView.
</script>

<template>
  <el-container class="rahmen">
    <el-header class="kopf">Treaty</el-header>
    <el-main>
      <RouterView />
    </el-main>
  </el-container>
</template>

<style>
/* Grundschrift der ganzen Seite. Steht bewusst nicht in "scoped", weil sie für body gilt. */
body {
  margin: 0;
  font-family: system-ui, sans-serif;
}
</style>

<style scoped>
.rahmen {
  min-height: 100vh;
}
.kopf {
  display: flex;
  align-items: center;
  font-size: 20px;
  font-weight: 600;
  border-bottom: 1px solid var(--el-border-color);
}
</style>
