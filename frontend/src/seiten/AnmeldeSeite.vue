<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ApiFehlerAntwort } from '../api/client';
import { sichererZielpfad } from '../navigation';
import { useSitzung } from '../stores/sitzung';

// Anmeldung mit Kürzel und Passwort (Entscheidung 15.10.2026).
// Bei falschen Angaben zeigt der Server bewusst immer dieselbe Meldung. Bei zu vielen
// Fehlversuchen (429) läuft ein Countdown aus Retry-After, so lange bleibt der Knopf gesperrt.

const sitzung = useSitzung();
const route = useRoute();
const router = useRouter();

const kuerzel = ref('');
const passwort = ref('');
const laeuft = ref(false);
const fehler = ref<string | null>(null);
const warteSekunden = ref(0);
let zeitgeber: ReturnType<typeof setInterval> | undefined;

const abgelaufen = computed(() => route.query.grund === 'abgelaufen');

function starteCountdown(sekunden: number) {
  warteSekunden.value = sekunden;
  clearInterval(zeitgeber);
  zeitgeber = setInterval(() => {
    warteSekunden.value -= 1;
    if (warteSekunden.value <= 0) {
      clearInterval(zeitgeber);
      fehler.value = null;
    }
  }, 1000);
}
onBeforeUnmount(() => clearInterval(zeitgeber));

async function absenden() {
  if (laeuft.value || warteSekunden.value > 0) return;
  fehler.value = null;
  laeuft.value = true;
  try {
    await sitzung.anmelden(kuerzel.value, passwort.value);
    await router.replace(
      sitzung.ich?.passwortWechselNoetig ? { name: 'passwort-aendern' } : sichererZielpfad(route.query.ziel),
    );
  } catch (f) {
    fehler.value = f instanceof ApiFehlerAntwort ? f.message : 'Unerwarteter Fehler bei der Anmeldung.';
    if (f instanceof ApiFehlerAntwort && f.status === 429) starteCountdown(f.wiederholenNachSekunden ?? 30);
  } finally {
    laeuft.value = false;
    passwort.value = '';
  }
}
</script>

<template>
  <el-card class="karte" header="Anmelden">
    <el-alert
      v-if="abgelaufen && !fehler"
      type="info"
      :closable="false"
      title="Ihre Sitzung ist abgelaufen. Bitte melden Sie sich erneut an."
      class="hinweis"
    />
    <el-alert v-if="fehler" type="error" :closable="false" :title="fehler" class="hinweis">
      <template v-if="warteSekunden > 0">Erneut möglich in {{ warteSekunden }} Sekunden.</template>
    </el-alert>

    <el-form label-position="top" @submit.prevent="absenden">
      <el-form-item label="Kürzel">
        <el-input v-model="kuerzel" autocomplete="username" autofocus />
      </el-form-item>
      <el-form-item label="Passwort">
        <el-input v-model="passwort" type="password" show-password autocomplete="current-password" />
      </el-form-item>
      <el-button
        type="primary"
        native-type="submit"
        :loading="laeuft"
        :disabled="warteSekunden > 0 || !kuerzel || !passwort"
      >
        Anmelden
      </el-button>
    </el-form>
  </el-card>
</template>

<style scoped>
.karte {
  max-width: 400px;
  margin: 48px auto;
}
.hinweis {
  margin-bottom: 16px;
}
</style>
