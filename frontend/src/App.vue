<script setup lang="ts">
import { ElMessage } from 'element-plus';
import { computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { sichtbareMenuepunkte } from './menue';
import { useSitzung } from './stores/sitzung';

// Rahmen der Anwendung. Die jeweilige Seite erscheint an der Stelle von RouterView.
// Rechts im Kopf stehen für Angemeldete Name und Kürzel mit einem kleinen Menü.

const sitzung = useSitzung();
const router = useRouter();
const route = useRoute();

// Menüpunkte nach der Rechtematrix. Während des Pflichtwechsels gibt es kein Menü.
const menue = computed(() => (sitzung.ich?.passwortWechselNoetig ? [] : sichtbareMenuepunkte(sitzung.ich)));

async function personenmenue(befehl: string) {
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
      <div class="links">
        <span class="name">Treaty</span>
        <el-menu v-if="menue.length > 0" mode="horizontal" :ellipsis="false" :default-active="String(route.name)" class="menue">
          <el-menu-item v-for="punkt in menue" :key="punkt.route" :index="punkt.route" @click="router.push({ name: punkt.route })">
            {{ punkt.titel }}
          </el-menu-item>
        </el-menu>
      </div>
      <el-dropdown v-if="sitzung.ich" trigger="click" @command="personenmenue">
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
      <!-- key: beim Wechsel von /benutzer/neu zu /benutzer/7 entsteht die Seite neu -->
      <RouterView :key="route.fullPath" />
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
.links {
  display: flex;
  align-items: center;
  gap: 24px;
}
.menue {
  border-bottom: none;
  font-weight: 400;
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
