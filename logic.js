// Pure logica, zonder browser- of Google-afhankelijkheden (zo is het testbaar).

export const DAGEN = ['zo', 'ma', 'di', 'wo', 'do', 'vrij', 'za'];
export const WANNEER = ['nacht', 'ochtend', 'voormiddag', 'namiddag', 'avond'];
export const INTENSITEIT = [
  { waarde: 1, label: 'weinig' },
  { waarde: 2, label: 'matig' },
  { waarde: 3, label: 'ernstig' },
];
export const MEDICATIE = [
  { code: 's', label: 'Sumatriptan' },
  { code: 'v', label: 'Voltaren' },
  { code: 'd', label: 'Dafalgan' },
];
export const STANDAARD_OORZAKEN = ['lopen', 'verkoudheid'];

// Kolommen in tab "Opname". Kolommen E t/m J (neus, snow, licht, ...) blijven onaangeroerd.
export const KOLOMMEN = {
  datum: 'A',
  dag: 'B',
  wanneer: 'C',
  intensiteit: 'D',
  medicatie: 'K',
  oorzaak: 'L',
  opmerking: 'M',
};
export const LAATSTE_KOLOM = 'M';

const kolomIndex = (letter) => letter.charCodeAt(0) - 65;

/** 'yyyy-mm-dd' -> 'ma', 'di', ... (zelfde afkortingen als in het bestaande dagboek) */
export function dagVanDeWeek(iso) {
  const [j, m, d] = iso.split('-').map(Number);
  return DAGEN[new Date(Date.UTC(j, m - 1, d)).getUTCDay()];
}

/** Lokale datum van vandaag als 'yyyy-mm-dd'. */
export function vandaagIso(nu = new Date()) {
  const p = (n) => String(n).padStart(2, '0');
  return `${nu.getFullYear()}-${p(nu.getMonth() + 1)}-${p(nu.getDate())}`;
}

/** ['d','s'] -> 'sd' (altijd in de volgorde s, v, d zoals in het dagboek: 'sv', 'svd', ...) */
export function medicatieCode(gekozen) {
  return MEDICATIE.map((m) => m.code).filter((c) => gekozen.includes(c)).join('');
}

/** Maakt de rij A..M. null = cel niet aanraken. */
export function bouwRij(ingave) {
  const rij = new Array(kolomIndex(LAATSTE_KOLOM) + 1).fill(null);
  const zet = (veld, waarde) => {
    if (waarde !== undefined && waarde !== null && waarde !== '') rij[kolomIndex(KOLOMMEN[veld])] = waarde;
  };
  zet('datum', ingave.datum);
  zet('dag', dagVanDeWeek(ingave.datum));
  zet('wanneer', ingave.wanneer);
  zet('intensiteit', ingave.intensiteit);
  zet('medicatie', medicatieCode(ingave.medicatie || []));
  zet('oorzaak', (ingave.oorzaak || '').trim());
  zet('opmerking', (ingave.opmerking || '').trim());
  return rij;
}

/**
 * values = antwoord van GET 'Opname!A2:M' (lege rijen achteraan worden door Google weggelaten).
 * Geeft het rijnummer (1-gebaseerd) van de eerste vrije rij.
 */
export function volgendeRijnummer(values) {
  return (values ? values.length : 0) + 2;
}

/** Fouten in de ingave, of een lege lijst. */
export function controleer(ingave) {
  const fouten = [];
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ingave.datum || '')) fouten.push('Kies een datum.');
  if (![1, 2, 3].includes(ingave.intensiteit)) fouten.push('Kies een intensiteit.');
  return fouten;
}

/** Oorzaak-suggesties: vaste suggesties + de vaakst gebruikte waarden uit kolom L. */
export function oorzaakSuggesties(values, max = 8) {
  const telling = new Map();
  const i = kolomIndex(KOLOMMEN.oorzaak);
  for (const rij of values || []) {
    const w = String(rij[i] ?? '').trim().toLowerCase().replace(/!+$/, '').trim();
    if (!/[a-zà-ÿ]/.test(w)) continue; // '???' en lege cellen overslaan
    telling.set(w, (telling.get(w) || 0) + 1);
  }
  const populair = [...telling.entries()].sort((a, b) => b[1] - a[1]).map(([w]) => w);
  return [...new Set([...STANDAARD_OORZAKEN, ...populair])].slice(0, max);
}

/** Laatste n ingevulde rijen (nieuwste eerst) als objecten om te tonen. */
export function laatsteIngaven(values, n = 5) {
  const k = (veld) => kolomIndex(KOLOMMEN[veld]);
  return (values || [])
    .filter((r) => r && r[0])
    .slice(-n)
    .reverse()
    .map((r) => ({
      datum: r[k('datum')] || '',
      dag: r[k('dag')] || '',
      wanneer: r[k('wanneer')] || '',
      intensiteit: r[k('intensiteit')] || '',
      medicatie: r[k('medicatie')] || '',
      oorzaak: r[k('oorzaak')] || '',
      opmerking: r[k('opmerking')] || '',
    }));
}

/** Haalt de spreadsheet-ID uit een volledige URL, of geeft de invoer terug. */
export function spreadsheetIdUit(invoer) {
  const s = (invoer || '').trim();
  const m = s.match(/\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/);
  return m ? m[1] : s;
}
