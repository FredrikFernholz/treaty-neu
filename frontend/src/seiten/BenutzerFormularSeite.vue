<script setup lang="ts">
import { ZUSATZRECHTE, ZUSATZRECHT_BEZEICHNUNG, type Berechtigung, type Zusatzrecht } from '@shared/rechte/rechtematrix.js';
import { ZEICHNUNGEN, type BenutzerDetail, type Sitzungsinfo } from '@shared/schemas/benutzer.js';
import { useQueryClient } from '@tanstack/vue-query';
import { ElMessage, ElMessageBox } from 'element-plus';
import { computed, onMounted, reactive, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import {
  aendereBenutzer,
  beendeSitzung,
  kuerzelVorschlag,
  ladeBenutzer,
  legeBenutzerAn,
  setzeAktiv,
  vergibEinmalpasswort,
} from '../api/benutzer';
import { ApiFehlerAntwort } from '../api/client';
import EinmalpasswortDialog from '../komponenten/EinmalpasswortDialog.vue';
import KonfliktDialog from '../komponenten/KonfliktDialog.vue';
import { useSitzung } from '../stores/sitzung';
import { BERECHTIGUNG_BEZEICHNUNG, ZEICHNUNG_BEZEICHNUNG } from '../texte';
import { zeitpunkt } from '../zeit';

// Benutzer anlegen (/benutzer/neu) und bearbeiten (/benutzer/:id), Teilschritte 10c und 10d.
// Beim Bearbeiten zusätzlich: Konto deaktivieren oder aktivieren, Einmalpasswort neu
// vergeben und laufende Sitzungen beenden.
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

const aktionLaeuft = ref(false);
/** Deaktivieren und Einmalpasswort: nicht für das eigene Konto und nicht im Nur-Lesen. */
const kontoAktionenErlaubt = computed(() => !istNeu.value && !nurLesen.value && !istSelbst.value);
const sitzungenBeendbar = computed(() => !istNeu.value && !nurLesen.value);

async function bestaetigt(titel: string, text: string, knopf: string): Promise<boolean> {
  try {
    await ElMessageBox.confirm(text, titel, { confirmButtonText: knopf, cancelButtonText: 'Abbrechen', type: 'warning' });
    return true;
  } catch {
    return false; // Abbrechen oder Dialog geschlossen
  }
}

/** Führt eine Aktion aus und lädt danach den aktuellen Stand, auch für die Liste. */
async function aktion(ausfuehren: () => Promise<void>) {
  formfehler.value = null;
  aktionLaeuft.value = true;
  try {
    await ausfuehren();
    await abfragen.invalidateQueries({ queryKey: ['benutzer'] });
  } catch (f) {
    zeigeFehler(f);
  } finally {
    aktionLaeuft.value = false;
  }
}

async function aktivUmschalten() {
  const b = geladen.value!;
  if (
    b.aktiv &&
    !(await bestaetigt(
      'Konto deaktivieren',
      `${b.name} kann sich danach nicht mehr anmelden. Alle laufenden Sitzungen enden sofort.`,
      'Deaktivieren',
    ))
  ) {
    return;
  }
  await aktion(async () => {
    uebernehme(await setzeAktiv(b.id, !b.aktiv, b.version));
    ElMessage.success(b.aktiv ? 'Konto deaktiviert.' : 'Konto aktiviert.');
  });
}

async function neuesEinmalpasswort() {
  const b = geladen.value!;
  const ok = await bestaetigt(
    'Einmalpasswort vergeben',
    `Das bisherige Passwort von ${b.name} gilt danach nicht mehr. Alle laufenden Sitzungen enden sofort.`,
    'Vergeben',
  );
  if (!ok) return;
  await aktion(async () => {
    einmalpasswort.value = (await vergibEinmalpasswort(b.id)).einmalpasswort;
    await laden();
  });
}

async function sitzungBeenden(eintrag: Sitzungsinfo) {
  const b = geladen.value!;
  if (eintrag.aktuell) {
    // Die eigene, gerade benutzte Sitzung: deutlicher nachfragen, danach direkt abmelden.
    try {
      await ElMessageBox.confirm(
        'Das ist die Sitzung, mit der Sie gerade arbeiten. Sie werden sofort abgemeldet.',
        'Diese Sitzung beenden',
        { confirmButtonText: 'Beenden und abmelden', cancelButtonText: 'Abbrechen', type: 'error' },
      );
    } catch {
      return;
    }
    await aktion(async () => {
      await beendeSitzung(b.id, eintrag.id);
      sitzung.vergessen();
      await router.replace({ name: 'anmelden' });
    });
    return;
  }
  if (!(await bestaetigt('Sitzung beenden', `Diese Sitzung von ${b.name} endet sofort.`, 'Beenden'))) return;
  await aktion(async () => {
    await beendeSitzung(b.id, eintrag.id);
    ElMessage.success('Sitzung beendet.');
    await laden();
  });
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

    <el-form label-position="top" class="formular" :disabled="nurLesen" @submit.prevent="speichern">
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

  <el-card v-if="geladen && !istNeu" class="karte" header="Konto">
    <p>
      <el-tag :type="geladen.aktiv ? 'success' : 'info'">{{ geladen.aktiv ? 'aktiv' : 'deaktiviert' }}</el-tag>
      <el-tag v-if="geladen.passwortWechselNoetig" type="warning" class="zweites">Passwortwechsel offen</el-tag>
    </p>
    <div v-if="kontoAktionenErlaubt">
      <el-button :type="geladen.aktiv ? 'danger' : 'success'" plain :loading="aktionLaeuft" @click="aktivUmschalten">
        {{ geladen.aktiv ? 'Deaktivieren' : 'Aktivieren' }}
      </el-button>
      <el-button :loading="aktionLaeuft" @click="neuesEinmalpasswort">Einmalpasswort vergeben</el-button>
    </div>
    <p v-else-if="istSelbst" class="erlaeuterung">
      Das eigene Konto lässt sich weder deaktivieren noch mit einem Einmalpasswort versehen. Ihr Passwort ändern Sie über
      das Menü oben rechts.
    </p>
  </el-card>

  <el-card v-if="geladen && !istNeu" class="karte" header="Angemeldet">
    <el-table :data="geladen.sitzungen" empty-text="Keine laufende Sitzung" class="sitzungen">
      <el-table-column width="130">
        <template #default="{ row }">
          <el-tag v-if="row.aktuell" type="primary" size="small">diese Sitzung</el-tag>
        </template>
      </el-table-column>
      <el-table-column label="Angemeldet seit" width="170">
        <template #default="{ row }">{{ zeitpunkt(row.erstelltAm) }}</template>
      </el-table-column>
      <el-table-column label="Zuletzt aktiv" width="170">
        <template #default="{ row }">{{ zeitpunkt(row.letzteAktivitaetAm) }}</template>
      </el-table-column>
      <el-table-column label="Endet spätestens" width="170">
        <template #default="{ row }">{{ zeitpunkt(row.laeuftAbAm) }}</template>
      </el-table-column>
      <el-table-column prop="ip" label="IP" width="140" />
      <!-- Lange Browserkennungen werden gekürzt, vollständig im Tooltip. -->
      <el-table-column prop="userAgent" label="Browser" min-width="160" show-overflow-tooltip />
      <el-table-column v-if="sitzungenBeendbar" width="110">
        <template #default="{ row }">
          <el-button size="small" :loading="aktionLaeuft" @click="sitzungBeenden(row as Sitzungsinfo)">Beenden</el-button>
        </template>
      </el-table-column>
    </el-table>
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
.zweites {
  margin-left: 6px;
}
.schmal {
  width: 160px;
}
</style>
