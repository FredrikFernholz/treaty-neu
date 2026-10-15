<script setup lang="ts">
import { useQuery } from '@tanstack/vue-query';
import { ref } from 'vue';

// Antwort von GET /api/health (siehe backend/src/server.ts).
type Health = { status: 'ok' | 'fehler'; datenbank: 'ok' | 'nicht erreichbar' };

// Fragt das Backend ab. Auch eine 503-Antwort enthält einen lesbaren Zustand,
// deshalb wird der Inhalt in beiden Fällen ausgewertet.
async function holeHealth(): Promise<Health> {
  const antwort = await fetch('/api/health');
  if (antwort.status !== 200 && antwort.status !== 503) {
    throw new Error(`Backend antwortet mit Status ${antwort.status}`);
  }
  return (await antwort.json()) as Health;
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
.karte {
  max-width: 480px;
  margin-bottom: 16px;
}
.knopf {
  margin-top: 16px;
}
</style>
