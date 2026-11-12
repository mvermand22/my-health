import {
  WANNEER, INTENSITEIT, MEDICATIE, LAATSTE_KOLOM,
  dagVanDeWeek, vandaagIso, bouwRij, volgendeRijnummer, controleer,
  oorzaakSuggesties, laatsteIngaven, spreadsheetIdUit, STANDAARD_OORZAKEN,
} from './logic.js';

const SCOPE = 'https://www.googleapis.com/auth/spreadsheets';
const API = 'https://sheets.googleapis.com/v4/spreadsheets';
const SLEUTEL = {
  instellingen: 'hp.instellingen',
  wachtrij: 'hp.wachtrij',
  token: 'hp.token',
  suggesties: 'hp.suggesties',
};

const $ = (id) => document.getElementById(id);

// ---------- opslag op het toestel ----------
const lees = (k, standaard) => {
  try { return JSON.parse(localStorage.getItem(k)) ?? standaard; } catch { return standaard; }
};
const schrijf = (k, v) => localStorage.setItem(k, JSON.stringify(v));

let inst = lees(SLEUTEL.instellingen, null);
const instellingenOk = () => inst && inst.clientId && inst.spreadsheetId && inst.tab;

const wachtrij = () => lees(SLEUTEL.wachtrij, []);
const zetWachtrij = (lijst) => { schrijf(SLEUTEL.wachtrij, lijst); toonBanner(); };

// ---------- Google-login (token van max. 1 uur, alleen in deze browser) ----------
function geldigToken() {
  const t = lees(SLEUTEL.token, null);
  return t && t.vervalt > Date.now() + 60_000 ? t.access_token : null;
}

function vraagToken() {
  return new Promise((resolve, reject) => {
    const oauth2 = window.google?.accounts?.oauth2;
    if (!oauth2) return reject(new Error('Google-login is nog niet geladen. Ben je online?'));
    const client = oauth2.initTokenClient({
      client_id: inst.clientId,
      scope: SCOPE,
      prompt: '',
      callback: (r) => {
        if (r.error) return reject(new Error(r.error_description || r.error));
        if (!oauth2.hasGrantedAllScopes(r, SCOPE)) {
          return reject(new Error('Geef de app toegang tot je spreadsheets (vinkje bij het aanmelden).'));
        }
        schrijf(SLEUTEL.token, { access_token: r.access_token, vervalt: Date.now() + r.expires_in * 1000 });
        resolve(r.access_token);
      },
      error_callback: (e) => reject(new Error(
        e?.type === 'popup_closed' ? 'Aanmelden geannuleerd.'
          : e?.type === 'popup_failed_to_open' ? 'Het aanmeldvenster werd geblokkeerd.'
            : 'Aanmelden mislukt.')),
    });
    client.requestAccessToken();
  });
}

// ---------- Google Sheets API ----------
const bereik = (r) => encodeURIComponent(`'${inst.tab.replace(/'/g, "''")}'!${r}`);

async function api(pad, opties = {}) {
  const token = geldigToken();
  if (!token) throw Object.assign(new Error('Je moet (opnieuw) aanmelden.'), { code: 'auth' });
  const res = await fetch(`${API}/${encodeURIComponent(inst.spreadsheetId)}${pad}`, {
    ...opties,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
  });
  if (res.status === 401) {
    localStorage.removeItem(SLEUTEL.token);
    throw Object.assign(new Error('Je aanmelding is verlopen.'), { code: 'auth' });
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = data?.error?.message || `Fout ${res.status}`;
    if (res.status === 404) throw new Error('Spreadsheet niet gevonden. Klopt de link in de instellingen?');
    if (/Unable to parse range/i.test(msg)) throw new Error(`Tabblad "${inst.tab}" niet gevonden.`);
    throw new Error(msg);
  }
  return data;
}

const haalRijen = async () =>
  (await api(`/values/${bereik(`A2:${LAATSTE_KOLOM}`)}`)).values || [];

let sheetIdCache = null;
async function haalSheetId() {
  if (sheetIdCache !== null) return sheetIdCache;
  const data = await api('?fields=sheets.properties(sheetId,title)');
  const blad = (data.sheets || []).find((s) => s.properties.title === inst.tab);
  if (!blad) throw new Error(`Tabblad "${inst.tab}" niet gevonden.`);
  return (sheetIdCache = blad.properties.sheetId);
}

async function schrijfRij(nr, ingave, sheetId) {
  await api(`/values/${bereik(`A${nr}:${LAATSTE_KOLOM}${nr}`)}?valueInputOption=USER_ENTERED`, {
    method: 'PUT',
    body: JSON.stringify({ values: [bouwRij(ingave)] }),
  });
  // Datum tonen zoals in de rest van het dagboek (d-m-yyyy). Niet erg als dit mislukt.
  try {
    await api(':batchUpdate', {
      method: 'POST',
      body: JSON.stringify({
        requests: [{
          repeatCell: {
            range: { sheetId, startRowIndex: nr - 1, endRowIndex: nr, startColumnIndex: 0, endColumnIndex: 1 },
            cell: { userEnteredFormat: { numberFormat: { type: 'DATE', pattern: 'd-m-yyyy' } } },
            fields: 'userEnteredFormat.numberFormat',
          },
        }],
      }),
    });
  } catch (e) { console.warn('Datumopmaak niet gelukt', e); }
}

// ---------- synchroniseren van de wachtrij ----------
let bezig = false;

/** interactief = mag een aanmeldvenster openen (alleen vanuit een klik). */
async function synchroniseer(interactief) {
  if (bezig || !instellingenOk() || !wachtrij().length || !navigator.onLine) return toonBanner();
  if (!geldigToken()) {
    if (!interactief) return toonBanner();
    await vraagToken(); // moet vóór de eerste andere await gebeuren (pop-up na klik)
  }
  bezig = true;
  try {
    const rijen = await haalRijen();
    const sheetId = await haalSheetId();
    let nr = volgendeRijnummer(rijen);
    for (const ingave of wachtrij()) {
      await schrijfRij(nr, ingave, sheetId);
      zetWachtrij(wachtrij().filter((i) => i.id !== ingave.id));
      nr += 1;
    }
  } finally {
    bezig = false;
    toonBanner();
  }
  await vernieuwRecent(false).catch(() => {});
}

// ---------- laatste ingaven + suggesties ----------
async function vernieuwRecent(interactief) {
  if (!instellingenOk()) return;
  if (!geldigToken()) {
    if (!interactief) return;
    await vraagToken();
  }
  const rijen = await haalRijen();
  schrijf(SLEUTEL.suggesties, oorzaakSuggesties(rijen));
  toonSuggesties();
  toonRecent(laatsteIngaven(rijen, 5));
}

function toonRecent(lijst) {
  const ul = $('recent-lijst');
  ul.replaceChildren();
  if (!lijst.length) {
    ul.append(Object.assign(document.createElement('li'), { className: 'stil', textContent: 'Nog geen ingaven.' }));
    return;
  }
  for (const r of lijst) {
    const li = document.createElement('li');
    const kop = document.createElement('div');
    kop.className = 'rij tussen';
    const links = document.createElement('strong');
    links.textContent = `${r.dag} ${r.datum}`;
    const rechts = document.createElement('span');
    rechts.className = `badge i${String(r.intensiteit).replace(/\D/g, '').slice(0, 1)}`;
    rechts.textContent = r.intensiteit;
    kop.append(links, rechts);
    const details = document.createElement('div');
    details.className = 'stil klein';
    details.textContent = [r.wanneer, r.medicatie && `med: ${r.medicatie.toUpperCase()}`, r.oorzaak, r.opmerking]
      .filter(Boolean).join(' · ');
    li.append(kop, details);
    ul.append(li);
  }
}

// ---------- formulier ----------
function maakChips(houder, opties) {
  const enkel = houder.hasAttribute('data-enkel');
  for (const { waarde, label } of opties) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'chip';
    b.dataset.waarde = waarde;
    b.setAttribute('aria-pressed', 'false');
    b.innerHTML = label;
    b.addEventListener('click', () => {
      const aan = b.getAttribute('aria-pressed') !== 'true';
      if (enkel) houder.querySelectorAll('.chip').forEach((c) => c.setAttribute('aria-pressed', 'false'));
      b.setAttribute('aria-pressed', String(aan));
    });
    houder.append(b);
  }
}
const gekozen = (id) => [...$(id).querySelectorAll('.chip[aria-pressed="true"]')].map((c) => c.dataset.waarde);

function toonSuggesties() {
  const houder = $('oorzaak-suggesties');
  houder.replaceChildren();
  for (const s of lees(SLEUTEL.suggesties, STANDAARD_OORZAKEN)) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'chip';
    b.textContent = s;
    b.addEventListener('click', () => {
      const veld = $('oorzaak');
      const delen = veld.value.split(',').map((d) => d.trim()).filter(Boolean);
      if (!delen.includes(s)) delen.push(s);
      veld.value = delen.join(', ');
    });
    houder.append(b);
  }
}

function toonDagnaam() {
  $('dagnaam').textContent = $('datum').value ? dagVanDeWeek($('datum').value) : '';
}

function leesFormulier() {
  const intensiteit = Number(gekozen('intensiteit')[0]) || null;
  return {
    datum: $('datum').value,
    wanneer: gekozen('wanneer')[0] || '',
    intensiteit,
    medicatie: gekozen('medicatie'),
    oorzaak: $('oorzaak').value,
    opmerking: $('opmerking').value,
  };
}

function wisFormulier() {
  $('datum').value = vandaagIso();
  toonDagnaam();
  document.querySelectorAll('#formulier .chip[aria-pressed]').forEach((c) => c.setAttribute('aria-pressed', 'false'));
  $('oorzaak').value = '';
  $('opmerking').value = '';
}

const nieuwId = () => (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`);

async function opslaan(e) {
  e.preventDefault();
  $('fout').hidden = true;
  if (!instellingenOk()) return openInstellingen();
  const ingave = leesFormulier();
  const fouten = controleer(ingave);
  if (fouten.length) {
    $('fout').textContent = fouten.join(' ');
    $('fout').hidden = false;
    return;
  }
  zetWachtrij([...wachtrij(), { ...ingave, id: nieuwId() }]);
  wisFormulier();

  if (!navigator.onLine) return toast('Bewaard op je toestel. Wordt verstuurd zodra je online bent.');
  const knop = $('knop-opslaan');
  knop.disabled = true;
  try {
    await synchroniseer(true);
    toast(wachtrij().length ? 'Bewaard op je toestel, nog niet verstuurd.' : 'Opgeslagen ✓');
  } catch (err) {
    toast(`Bewaard op je toestel, nog niet verstuurd: ${err.message}`, true);
  } finally {
    knop.disabled = false;
  }
}

// ---------- meldingen ----------
function toonBanner() {
  const aantal = wachtrij().length;
  const offline = !navigator.onLine;
  const banner = $('banner');
  if (!offline && !aantal) { banner.hidden = true; return; }
  const n = aantal === 1 ? '1 ingave' : `${aantal} ingaven`;
  $('banner-tekst').textContent = offline
    ? `Offline${aantal ? ` · ${n} wacht${aantal === 1 ? '' : 'en'}` : ' · ingaven worden op je toestel bewaard'}`
    : `${n} nog niet verstuurd`;
  $('banner-knop').hidden = offline || !aantal;
  banner.classList.toggle('offline', offline);
  banner.hidden = false;
}

let toastTimer;
function toast(tekst, fout = false) {
  const t = $('toast');
  t.textContent = tekst;
  t.classList.toggle('fout', fout);
  t.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { t.hidden = true; }, fout ? 6000 : 3000);
}

// ---------- instellingen ----------
function openInstellingen() {
  $('set-client').value = inst?.clientId || '';
  $('set-sheet').value = inst?.spreadsheetId || '';
  $('set-tab').value = inst?.tab || 'Opname';
  $('instellingen').showModal();
}

function toonSheetLink() {
  const a = $('link-sheet');
  if (instellingenOk()) {
    a.href = `https://docs.google.com/spreadsheets/d/${encodeURIComponent(inst.spreadsheetId)}/edit`;
    a.hidden = false;
  } else a.hidden = true;
}

$('instellingen').addEventListener('close', () => {
  if ($('instellingen').returnValue !== 'ok') return;
  const nieuw = {
    clientId: $('set-client').value.trim(),
    spreadsheetId: spreadsheetIdUit($('set-sheet').value),
    tab: $('set-tab').value.trim() || 'Opname',
  };
  if (inst && (inst.clientId !== nieuw.clientId)) localStorage.removeItem(SLEUTEL.token);
  inst = nieuw;
  sheetIdCache = null;
  schrijf(SLEUTEL.instellingen, inst);
  toonSheetLink();
  toast('Instellingen bewaard.');
});

$('knop-afmelden').addEventListener('click', () => {
  const t = lees(SLEUTEL.token, null);
  if (t && window.google?.accounts?.oauth2) google.accounts.oauth2.revoke(t.access_token, () => {});
  localStorage.removeItem(SLEUTEL.token);
  toonRecent([]);
  $('recent-lijst').firstChild.textContent = 'Afgemeld.';
  $('instellingen').close();
});

// ---------- opstarten ----------
maakChips($('wanneer'), WANNEER.map((w) => ({ waarde: w, label: w })));
maakChips($('intensiteit'), INTENSITEIT.map((i) => ({ waarde: i.waarde, label: `<b>${i.waarde}</b>${i.label}` })));
maakChips($('medicatie'), MEDICATIE.map((m) => ({ waarde: m.code, label: m.label })));
toonSuggesties();
wisFormulier();
toonSheetLink();
toonBanner();

$('datum').addEventListener('change', toonDagnaam);
$('formulier').addEventListener('submit', opslaan);
$('knop-instellingen').addEventListener('click', openInstellingen);
$('banner-knop').addEventListener('click', () =>
  synchroniseer(true).then(() => toast('Verstuurd ✓')).catch((e) => toast(e.message, true)));
$('knop-vernieuwen').addEventListener('click', () =>
  vernieuwRecent(true).catch((e) => toast(e.message, true)));
window.addEventListener('online', () => synchroniseer(false).catch(() => {}));
window.addEventListener('offline', toonBanner);

if (!instellingenOk()) openInstellingen();
else if (geldigToken()) {
  synchroniseer(false).catch(() => {});
  vernieuwRecent(false).catch(() => {});
}

if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
