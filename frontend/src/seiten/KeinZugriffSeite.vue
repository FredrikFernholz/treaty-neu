<template>
  <!-- Erscheint, wenn eine Seite einen Bereich verlangt, den die Rechtematrix nicht erlaubt. -->
  <el-result icon="warning" title="Kein Zugriff" sub-title="Für diesen Bereich fehlt Ihnen die Berechtigung.">
    <template #extra>
      <el-button type="primary" @click="$router.push({ name: 'start' })">Zur Startseite</el-button>
    </template>
  </el-result>
</template>
