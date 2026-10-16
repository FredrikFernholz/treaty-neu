<script setup lang="ts">
import { healthSchema, type Health } from '@shared/schemas/health.js';
import { useQuery } from '@tanstack/vue-query';
import { ref } from 'vue';

// Fragt das Backend ab. Auch eine 503-Antwort enthält einen lesbaren Zustand,
// deshalb wird der Inhalt in beiden Fällen ausgewertet.
async function holeHealth(): Promise<Health> {
  const antwort = await fetch('/api/health');
  if (antwort.status !== 200 && antwort.status !== 503) {
    throw new Error(`Backend antwortet mit Status ${antwort.status}`);
  }
  // Prüft die Antwort mit demselben Schema, das auch das Backend verwendet.
  // Passt sie nicht, wirft parse einen Fehler, und die Seite zeigt ihn an.
  return healthSchema.parse(await antwort.json());
}

const { data, error, isPending, refetch, isFetching } = useQuery({
  queryKey: ['health'],
  queryFn: holeHealth,
});

// Nur zum Nachweis der deutschen Sprachdatei: Monats- und Tagesnamen im Kalender.
const probeDatum = ref<Date>();
</script>

<template>
  <el-card header="Systemzustand" class="karte">
    <p v-if="isPending">Wird geprüft …</p>
    <el-alert
      v-else-if="error"
      type="error"
      :closable="false"
      title="Backend nicht erreichbar"
      :description="error.message"
    />
    <el-descriptions v-else-if="data" :column="1" border>
      <el-descriptions-item label="Backend">
        <el-tag :type="data.status === 'ok' ? 'success' : 'danger'">{{ data.status }}</el-tag>
      </el-descriptions-item>
      <el-descriptions-item label="Datenbank">
        <el-tag :type="data.datenbank === 'ok' ? 'success' : 'danger'">{{ data.datenbank }}</el-tag>
      </el-descriptions-item>
    </el-descriptions>

    <el-button class="knopf" :loading="isFetching" @click="refetch()">Erneut prüfen</el-button>
  </el-card>

  <el-card header="Probe Sprachdatei" class="karte">
    <el-date-picker v-model="probeDatum" type="date" placeholder="Datum wählen" format="DD.MM.YYYY" />
  </el-card>
</template>

<style scoped>
.knopf {
  margin-top: 16px;
}
</style>
