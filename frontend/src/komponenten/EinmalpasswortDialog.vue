<script setup lang="ts">
import { ElMessage } from 'element-plus';

// Zeigt ein Einmalpasswort genau einmal an (nach dem Anlegen und später bei der
// Neuvergabe). Das Passwort lebt nur in der Variablen der aufrufenden Seite. Es kommt
// weder in den Store noch in den Zwischenspeicher von TanStack Query. Beim Schließen
// setzt die Seite es auf null, danach ist es im Browser nicht mehr vorhanden.

const props = defineProps<{ passwort: string | null; kuerzel: string }>();
const emit = defineEmits<{ geschlossen: [] }>();

async function kopieren() {
  if (!props.passwort) return;
  try {
    await navigator.clipboard.writeText(props.passwort);
    ElMessage.success('In die Zwischenablage kopiert.');
  } catch {
    ElMessage.warning('Kopieren nicht möglich. Bitte das Passwort markieren und abschreiben.');
  }
}
</script>

<template>
  <el-dialog
    :model-value="passwort !== null"
    title="Einmalpasswort"
    width="480px"
    :close-on-click-modal="false"
    :close-on-press-escape="false"
    @update:model-value="(offen: boolean) => !offen && emit('geschlossen')"
  >
    <p>Einmalpasswort für <strong>{{ kuerzel }}</strong>:</p>
    <div class="passwort">{{ passwort }}</div>
    <el-alert
      type="warning"
      :closable="false"
      title="Wird nur jetzt angezeigt."
      description="Bitte auf sicherem Weg weitergeben, nicht per E-Mail. Bei der ersten Anmeldung damit muss ein eigenes Passwort festgelegt werden."
    />
    <template #footer>
      <el-button @click="kopieren">Kopieren</el-button>
      <el-button type="primary" @click="emit('geschlossen')">Notiert, schließen</el-button>
    </template>
  </el-dialog>
</template>

<style scoped>
.passwort {
  font-family: ui-monospace, monospace;
  font-size: 20px;
  letter-spacing: 1px;
  padding: 12px;
  margin: 8px 0 16px;
  text-align: center;
  background: var(--el-fill-color-light);
  border-radius: 4px;
  user-select: all;
}
</style>
