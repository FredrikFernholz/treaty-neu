<script setup lang="ts">
import { ZUSATZRECHT_BEZEICHNUNG } from '@shared/rechte/rechtematrix.js';
import type { Benutzer } from '@shared/schemas/benutzer.js';
import { useQuery } from '@tanstack/vue-query';
import { ref } from 'vue';
import { listeBenutzer } from '../api/benutzer';
import { kreuzchenliste } from '../rechteuebersicht';
import { BERECHTIGUNG_BEZEICHNUNG, ZEICHNUNG_BEZEICHNUNG } from '../texte';

// Nutzerverwaltung, Übersicht (Teilschritt 10b): Liste aller Benutzer und die
// Kreuzchenliste der Rechtematrix. Die Reihenfolge der Liste kommt vom Server
// (deaktivierte am Ende, sonst nach Name).

const reiter = ref<'benutzer' | 'rechte'>('benutzer');
const { data: benutzer, error, isPending } = useQuery({ queryKey: ['benutzer'], queryFn: listeBenutzer });
const rechte = kreuzchenliste();

/** „Zusätzlich: …“ unter dem Namen, wie in der Felddokumentation beschrieben. */
function zusaetzlich(b: Benutzer): string | null {
  if (b.zusatzrechte.length === 0) return null;
  return `Zusätzlich: ${b.zusatzrechte.map((r) => ZUSATZRECHT_BEZEICHNUNG[r]).join(', ')}`;
}

function zeilenklasse({ row }: { row: Benutzer }) {
  return row.aktiv ? '' : 'deaktiviert';
}
</script>

<template>
  <h2>Nutzerverwaltung</h2>
  <el-tabs v-model="reiter">
    <el-tab-pane label="Benutzer" name="benutzer">
      <el-alert v-if="error" type="error" :closable="false" :title="error.message" />
      <el-table v-else v-loading="isPending" :data="benutzer ?? []" :row-class-name="zeilenklasse" empty-text="Keine Benutzer">
        <el-table-column prop="kuerzel" label="Kürzel" width="100" />
        <el-table-column label="Name" min-width="220">
          <template #default="{ row }">
            <div>{{ row.name }}</div>
            <div v-if="zusaetzlich(row as Benutzer)" class="zusaetzlich">{{ zusaetzlich(row as Benutzer) }}</div>
          </template>
        </el-table-column>
        <el-table-column prop="email" label="E-Mail" min-width="220" />
        <el-table-column label="Berechtigung" width="170">
          <template #default="{ row }">{{ BERECHTIGUNG_BEZEICHNUNG[row.berechtigung as Benutzer['berechtigung']] }}</template>
        </el-table-column>
        <el-table-column label="Zeichnung" width="110">
          <template #default="{ row }">{{ ZEICHNUNG_BEZEICHNUNG[row.zeichnung as Benutzer['zeichnung']] }}</template>
        </el-table-column>
        <el-table-column label="Status" width="200">
          <template #default="{ row }">
            <el-tag v-if="!row.aktiv" type="info">deaktiviert</el-tag>
            <el-tag v-else type="success">aktiv</el-tag>
            <el-tag v-if="row.aktiv && row.passwortWechselNoetig" type="warning" class="zweites">Passwortwechsel offen</el-tag>
          </template>
        </el-table-column>
      </el-table>
    </el-tab-pane>

    <el-tab-pane label="Rechtematrix" name="rechte">
      <p class="erlaeuterung">
        Wer welchen Bereich nutzen darf. Zusatzrechte gelten nur zusätzlich und nehmen nie ein Recht weg. Das Zusatzrecht
        „{{ ZUSATZRECHT_BEZEICHNUNG.zeiterfassung_alle }}“ öffnet keinen Bereich, sondern zeigt in der Zeiterfassung die
        Buchungen aller statt nur der eigenen.
      </p>
      <el-table :data="rechte" class="matrix">
        <el-table-column prop="bereich" label="Bereich" min-width="200" />
        <el-table-column label="Administrator" width="140" align="center">
          <template #default="{ row }">{{ row.administrator ? '✓' : '–' }}</template>
        </el-table-column>
        <el-table-column label="Sachbearbeiter/in" width="160" align="center">
          <template #default="{ row }">{{ row.sachbearbeiter ? '✓' : '–' }}</template>
        </el-table-column>
        <el-table-column label="Freischaltung per Zusatzrecht" min-width="220">
          <template #default="{ row }">{{ row.perZusatzrecht ?? '–' }}</template>
        </el-table-column>
      </el-table>
    </el-tab-pane>
  </el-tabs>
</template>

<style scoped>
.zusaetzlich {
  font-size: 12px;
  color: var(--el-color-primary);
}
.zweites {
  margin-left: 6px;
}
.erlaeuterung {
  color: var(--el-text-color-secondary);
  max-width: 760px;
}
.matrix {
  max-width: 760px;
}
:deep(.deaktiviert) {
  color: var(--el-text-color-placeholder);
}
</style>
