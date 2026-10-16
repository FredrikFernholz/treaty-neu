<script setup lang="ts">
import { PASSWORT_MINDESTLAENGE, passwortSchema } from '@shared/schemas/passwort.js';
import { ElMessage } from 'element-plus';
import { computed, ref } from 'vue';
import { useRouter } from 'vue-router';
import { ApiFehlerAntwort } from '../api/client';
import { useSitzung } from '../stores/sitzung';

// Eigenes Passwort ändern, auch der Pflichtwechsel nach einem Einmalpasswort.
// Länge und Übereinstimmung prüft schon der Browser (gemeinsames Schema). Ob das
// Passwort zu verbreitet ist, weiß nur der Server, seine Meldung erscheint im Formular.

const sitzung = useSitzung();
const router = useRouter();

const altes = ref('');
const neues = ref('');
const wiederholung = ref('');
const laeuft = ref(false);
const fehler = ref<string | null>(null);
const altesFalsch = ref<string | null>(null);

const pflicht = computed(() => sitzung.ich?.passwortWechselNoetig === true);

/** Hinweise, die schon vor dem Absenden feststehen. */
const hinweisNeu = computed(() => {
  if (!neues.value) return null;
  const ergebnis = passwortSchema.safeParse(neues.value);
  return ergebnis.success ? null : (ergebnis.error.issues[0]?.message ?? null);
});
const hinweisWiederholung = computed(() =>
  wiederholung.value && wiederholung.value !== neues.value ? 'Die beiden neuen Passwörter stimmen nicht überein.' : null,
);
const absendbar = computed(
  () => altes.value && neues.value && wiederholung.value && !hinweisNeu.value && !hinweisWiederholung.value,
);

async function absenden() {
  if (!absendbar.value || laeuft.value) return;
  fehler.value = null;
  altesFalsch.value = null;
  laeuft.value = true;
  const warPflicht = pflicht.value;
  try {
    await sitzung.passwortAendern(altes.value, neues.value);
    ElMessage.success('Ihr Passwort wurde geändert.');
    altes.value = neues.value = wiederholung.value = '';
    if (warPflicht) await router.replace({ name: 'start' });
  } catch (f) {
    if (f instanceof ApiFehlerAntwort && f.code === 'passwort_falsch') altesFalsch.value = f.message;
    else if (f instanceof ApiFehlerAntwort && f.status === 429) {
      fehler.value = `${f.message} Erneut möglich in ${f.wiederholenNachSekunden ?? 30} Sekunden.`;
    } else fehler.value = f instanceof ApiFehlerAntwort ? f.message : 'Unerwarteter Fehler.';
  } finally {
    laeuft.value = false;
  }
}
</script>

<template>
  <el-card class="karte" header="Passwort ändern">
    <el-alert
      v-if="pflicht"
      type="warning"
      :closable="false"
      class="hinweis"
      title="Bitte legen Sie ein eigenes Passwort fest."
      description="Sie haben sich mit einem Einmalpasswort angemeldet. Erst danach ist Treaty nutzbar."
    />
    <el-alert v-if="fehler" type="error" :closable="false" :title="fehler" class="hinweis" />

    <el-form label-position="top" @submit.prevent="absenden">
      <el-form-item :label="pflicht ? 'Einmalpasswort' : 'Bisheriges Passwort'" :error="altesFalsch ?? ''">
        <el-input v-model="altes" type="password" show-password autocomplete="current-password" />
      </el-form-item>
      <el-form-item label="Neues Passwort" :error="hinweisNeu ?? ''">
        <el-input v-model="neues" type="password" show-password autocomplete="new-password" />
        <div class="erlaeuterung">Mindestens {{ PASSWORT_MINDESTLAENGE }} Zeichen. Eine Passphrase aus mehreren Wörtern ist gut geeignet.</div>
      </el-form-item>
      <el-form-item label="Neues Passwort wiederholen" :error="hinweisWiederholung ?? ''">
        <el-input v-model="wiederholung" type="password" show-password autocomplete="new-password" />
      </el-form-item>
      <el-button type="primary" native-type="submit" :loading="laeuft" :disabled="!absendbar">Passwort ändern</el-button>
    </el-form>
  </el-card>
</template>

<style scoped>
.karte {
  max-width: 440px;
  margin: 48px auto;
}
.hinweis {
  margin-bottom: 16px;
}
.erlaeuterung {
  font-size: 12px;
  color: var(--el-text-color-secondary);
  line-height: 1.4;
  margin-top: 4px;
}
</style>
