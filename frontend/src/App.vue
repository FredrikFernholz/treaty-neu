<script setup lang="ts">
import { ElMessage } from 'element-plus';
import { useRouter } from 'vue-router';
import { useSitzung } from './stores/sitzung';

// Rahmen der Anwendung. Die jeweilige Seite erscheint an der Stelle von RouterView.
// Rechts im Kopf stehen für Angemeldete Name und Kürzel mit einem kleinen Menü.

const sitzung = useSitzung();
const router = useRouter();

async function menue(befehl: string) {
  if (befehl === 'passwort') {
    await router.push({ name: 'passwort-aendern' });
  } else if (befehl === 'abmelden') {
    try {
      await sitzung.abmelden();
    } catch {
      // Im Browser gilt man trotzdem als abgemeldet (siehe Store).
      ElMessage.warning('Der Server hat nicht geantwortet. Sie sind in diesem Browser abgemeldet.');
    }
    await router.replace({ name: 'anmelden' });
  }
}
</script>

<template>
  <el-container class="rahmen">
    <el-header class="kopf">
      <span>Treaty</span>
      <el-dropdown v-if="sitzung.ich" trigger="click" @command="menue">
        <el-button text>{{ sitzung.ich.name }} ({{ sitzung.ich.kuerzel }})</el-button>
        <template #dropdown>
          <el-dropdown-menu>
            <el-dropdown-item command="passwort">Passwort ändern</el-dropdown-item>
            <el-dropdown-item command="abmelden" divided>Abmelden</el-dropdown-item>
          </el-dropdown-menu>
        </template>
      </el-dropdown>
    </el-header>
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
  justify-content: space-between;
  font-size: 20px;
  font-weight: 600;
  border-bottom: 1px solid var(--el-border-color);
}
</style>
