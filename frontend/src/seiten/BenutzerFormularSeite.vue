<script setup lang="ts">
import { ZUSATZRECHTE, ZUSATZRECHT_BEZEICHNUNG, type Berechtigung, type Zusatzrecht } from '@shared/rechte/rechtematrix.js';
import { ZEICHNUNGEN, type BenutzerDetail } from '@shared/schemas/benutzer.js';
import { useQueryClient } from '@tanstack/vue-query';
import { ElMessage } from 'element-plus';
import { computed, onMounted, reactive, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { aendereBenutzer, kuerzelVorschlag, ladeBenutzer, legeBenutzerAn } from '../api/benutzer';
import { ApiFehlerAntwort } from '../api/client';
import EinmalpasswortDialog from '../komponenten/EinmalpasswortDialog.vue';
import KonfliktDialog from '../komponenten/KonfliktDialog.vue';
import { useSitzung } from '../stores/sitzung';
import { BERECHTIGUNG_BEZEICHNUNG, ZEICHNUNG_BEZEICHNUNG } from '../texte';

// Benutzer anlegen (/benutzer/neu) und bearbeiten (/benutzer/:id), Teilschritt 10c.
//
// Die Oberfläche bildet die Regeln aus A-19 nach, damit niemand Knöpfe sieht, die der
// Server ohnehin ablehnt. Maßgeblich bleibt der Server:
//  - Berechtigungsstufe und Zusatzrechte ändern nur Administratoren.
//  - Mit dem Zusatzrecht nutzerverwaltung lassen sich Administratoren und das eigene
//    Konto nur ansehen.
//  - Die eigene Berechtigungsstufe kann niemand herabsetzen.
// Das Kürzel wird beim Anlegen aus dem Namen vorgeschlagen und lässt sich bis zum
// Speichern ändern, danach ist es unveränderlich (A-18).

const route = useRoute();
const router = useRouter();
const sitzung = useSitzung();
const abfragen = useQueryClient();

const id = computed(() => (route.name === 'benutzer-bearbeiten' ? Number(route.params.id) : null));
const istNeu = computed(() => id.value === null);
const istAdmin = computed(() => sitzung.ich?.berechtigung === 'administrator');

const formular = reactive({
  kuerzel: '',
  name: '',
  email: '',
  berechtigung: 'sachbearbeiter' as Berechtigung,
  zeichnung: 'ohne' as (typeof ZEICHNUNGEN)[number],
  bezeichnung: '',
  zusatzrechte: [] as Zusatzrecht[],
});
const geladen = ref<BenutzerDetail | null>(null);
const ladefehler = ref<string | null>(null);
const formfehler = ref<string | null>(null);
const speichert = ref(false);
const konfliktOffen = ref(false);
const einmalpasswort = ref<string | null>(null);
let angelegteId: number | null = null;
/** true, sobald das Kürzel von Hand geändert wurde. Dann wird nichts mehr vorgeschlagen. */
const kuerzelVonHand = ref(false);

const istSelbst = computed(() => geladen.value !== null && geladen.value.kuerzel === sitzung.ich?.kuerzel);
/** Mit nutzerverwaltung, aber ohne Administrator: Administratoren und sich selbst nur ansehen. */
const nurLesen = computed(
  () => !istNeu.value && !istAdmin.value && (geladen.value?.berechtigung === 'administrator' || istSelbst.value),
);

function uebernehme(b: BenutzerDetail) {
  geladen.value = b;
  Object.assign(formular, {
    kuerzel: b.kuerzel,
    name: b.name,
    email: b.email,
    berechtigung: b.berechtigung,
    zeichnung: b.zeichnung,
    bezeichnung: b.bezeichnung ?? '',
    zusatzrechte: [...b.zusatzrechte],
  });
}

async function laden() {
  if (id.value === null) return;
  ladefehler.value = null;
  try {
    uebernehme(await ladeBenutzer(id.value));
  } catch (f) {
    ladefehler.value = f instanceof ApiFehlerAntwort ? f.message : 'Der Benutzer konnte nicht geladen werden.';
  }
}
onMounted(laden);

async function schlageKuerzelVor() {
  if (!istNeu.value || kuerzelVonHand.value || !formular.name.trim()) return;
  try {
    const vorschlag = await kuerzelVorschlag(formular.name);
    if (vorschlag && !kuerzelVonHand.value) formular.kuerzel = vorschlag;
  } catch {
    // Ohne Vorschlag kann das Kürzel trotzdem von Hand eingegeben werden.
  }
}

function zeigeFehler(f: unknown) {
  if (!(f instanceof ApiFehlerAntwort)) {
    formfehler.value = 'Unerwarteter Fehler beim Speichern.';
  } else if (f.code === 'konflikt') {
    konfliktOffen.value = true;
  } else if (f.code === 'kein_zugriff' || f.code === 'nicht_erlaubt') {
    ElMessage.error(f.message);
  } else {
    formfehler.value = f.message;
  }
}

async function speichern() {
  formfehler.value = null;
  speichert.value = true;
  // Administratoren haben keine Zusatzrechte (Entscheidung 16.10.2026).
  const zusatzrechte = formular.berechtigung === 'administrator' ? [] : formular.zusatzrechte;
  try {
    if (id.value === null) {
      const ergebnis = await legeBenutzerAn({ ...formular, zusatzrechte });
      angelegteId = ergebnis.benutzer.id;
      formular.kuerzel = ergebnis.benutzer.kuerzel;
      einmalpasswort.value = ergebnis.einmalpasswort;
    } else {
      const { kuerzel: _unveraenderlich, ...rest } = formular;
      uebernehme(await aendereBenutzer(id.value, { ...rest, zusatzrechte, version: geladen.value!.version }));
      ElMessage.success('Gespeichert.');
    }
    await abfragen.invalidateQueries({ queryKey: ['benutzer'] });
  } catch (f) {
    zeigeFehler(f);
  } finally {
    speichert.value = false;
  }
}

async function nachKonfliktNeuLaden() {
  konfliktOffen.value = false;
  formfehler.value = null;
  await laden();
}

async function einmalpasswortGeschlossen() {
  einmalpasswort.value = null; // ab hier ist das Passwort im Browser nicht mehr vorhanden
  if (angelegteId !== null) await router.replace({ name: 'benutzer-bearbeiten', params: { id: angelegteId } });
}
</script>

<template>
  <el-page-header @back="router.push({ name: 'benutzer' })">
    <template #content>{{ istNeu ? 'Neuer Benutzer' : (geladen?.name ?? 'Benutzer') }}</template>
  </el-page-header>

  <el-alert v-if="ladefehler" type="error" :closable="false" :title="ladefehler" class="abstand" />

  <el-card v-else-if="istNeu || geladen" class="karte">
    <el-alert
      v-if="nurLesen"
      type="info"
      :closable="false"
      class="abstand"
      :title="istSelbst ? 'Das eigene Konto kann nur ein Administrator ändern.' : 'Administratoren kann nur ein Administrator bearbeiten.'"
    />
    <el-alert v-if="formfehler" type="error" :closable="false" :title="formfehler" class="abstand" />
    <el-alert
      v-if="geladen && !geladen.aktiv"
      type="info"
      :closable="false"
      class="abstand"
      title="Dieses Konto ist deaktiviert."
    />

    <el-form label-position="top" :disabled="nurLesen" @submit.prevent="speichern">
      <el-form-item label="Name">
        <el-input v-model="formular.name" maxlength="100" @blur="schlageKuerzelVor" />
      </el-form-item>
      <el-form-item label="Kürzel">
        <el-input
          v-if="istNeu"
          v-model="formular.kuerzel"
          maxlength="10"
          placeholder="wird aus dem Namen vorgeschlagen"
          @input="kuerzelVonHand = true"
        />
        <template v-else>
          <strong>{{ formular.kuerzel }}</strong>
          <span class="erlaeuterung"> Das Kürzel ist nach dem Anlegen nicht mehr änderbar.</span>
        </template>
      </el-form-item>
      <el-form-item label="E-Mail-Adresse">
        <el-input v-model="formular.email" type="email" maxlength="255" />
      </el-form-item>
      <el-form-item label="Berechtigungsstufe">
        <el-radio-group v-model="formular.berechtigung" :disabled="!istAdmin">
          <el-radio value="sachbearbeiter" :disabled="istSelbst && istAdmin">{{ BERECHTIGUNG_BEZEICHNUNG.sachbearbeiter }}</el-radio>
          <el-radio value="administrator">{{ BERECHTIGUNG_BEZEICHNUNG.administrator }}</el-radio>
        </el-radio-group>
        <div v-if="!istAdmin" class="erlaeuterung">Die Berechtigungsstufe ändern nur Administratoren.</div>
        <div v-else-if="istSelbst" class="erlaeuterung">Die eigene Berechtigungsstufe kann nicht herabgesetzt werden.</div>
      </el-form-item>
      <el-form-item v-if="formular.berechtigung !== 'administrator'" label="Zusätzliche Berechtigungen (Ausnahme)">
        <el-checkbox-group v-model="formular.zusatzrechte" :disabled="!istAdmin">
          <el-checkbox v-for="recht in ZUSATZRECHTE" :key="recht" :value="recht">{{ ZUSATZRECHT_BEZEICHNUNG[recht] }}</el-checkbox>
        </el-checkbox-group>
        <div v-if="!istAdmin" class="erlaeuterung">Zusatzrechte vergeben nur Administratoren.</div>
      </el-form-item>
      <el-form-item label="Zeichnung">
        <el-select v-model="formular.zeichnung" class="schmal">
          <el-option v-for="z in ZEICHNUNGEN" :key="z" :value="z" :label="ZEICHNUNG_BEZEICHNUNG[z]" />
        </el-select>
      </el-form-item>
      <el-form-item label="Bezeichnung / Abteilung (für den Signaturblock)">
        <el-input v-model="formular.bezeichnung" maxlength="100" />
      </el-form-item>
      <el-button v-if="!nurLesen" type="primary" native-type="submit" :loading="speichert">
        {{ istNeu ? 'Anlegen' : 'Speichern' }}
      </el-button>
    </el-form>
  </el-card>

  <EinmalpasswortDialog :passwort="einmalpasswort" :kuerzel="formular.kuerzel" @geschlossen="einmalpasswortGeschlossen" />
  <KonfliktDialog
    :sichtbar="konfliktOffen"
    meldung="Dieser Benutzer wurde inzwischen von jemand anderem geändert."
    @neu-laden="nachKonfliktNeuLaden"
    @schliessen="konfliktOffen = false"
  />
</template>

<style scoped>
.karte {
  max-width: 640px;
  margin-top: 16px;
}
.abstand {
  margin: 16px 0;
}
.erlaeuterung {
  font-size: 12px;
  color: var(--el-text-color-secondary);
  width: 100%;
}
.schmal {
  width: 160px;
}
</style>
