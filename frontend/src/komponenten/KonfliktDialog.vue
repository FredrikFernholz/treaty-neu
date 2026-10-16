<script setup lang="ts">
// Dialog bei 409 "konflikt": Jemand anderes hat den Datensatz inzwischen gespeichert
// (optimistisches Sperren mit version, Konzeption 6.1).
//
// In der Benutzerverwaltung genügt "Neu laden", die eigenen Eingaben werden dabei
// verworfen (Entscheidung 16.10.2026). Für das Datenblatt in Ausbaustufe 3 soll derselbe
// Dialog die eigenen Eingaben neben dem neuen Stand zeigen (Merkposten). Dafür ist der
// Platz "vergleich" vorgesehen. Bleibt er leer, erscheint nur die Meldung.

defineProps<{ sichtbar: boolean; meldung?: string }>();
const emit = defineEmits<{ neuLaden: []; schliessen: [] }>();
</script>

<template>
  <el-dialog
    :model-value="sichtbar"
    title="Inzwischen geändert"
    width="520px"
    :close-on-click-modal="false"
    @update:model-value="(offen: boolean) => !offen && emit('schliessen')"
  >
    <p>{{ meldung ?? 'Der Datensatz wurde inzwischen von jemand anderem geändert.' }}</p>
    <slot name="vergleich">
      <p>Beim Neuladen erscheint der aktuelle Stand. Ihre Eingaben in diesem Formular gehen dabei verloren.</p>
    </slot>
    <template #footer>
      <el-button @click="emit('schliessen')">Abbrechen</el-button>
      <el-button type="primary" @click="emit('neuLaden')">Neu laden</el-button>
    </template>
  </el-dialog>
</template>
