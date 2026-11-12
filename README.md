# Hoofdpijn-dagboek (PWA)

Kleine webapp om hoofdpijn snel te noteren. Elke ingave komt als nieuwe rij in het tabblad
**Opname** van je Google Spreadsheet. De app werkt op je Android-gsm en op je laptop, en ook
offline: ingaven wachten dan op je toestel tot je weer verbinding hebt.

## Welke kolommen de app invult

| Kolom | Inhoud | Voorbeeld |
|---|---|---|
| A | datum | 12-11-2026 |
| B | dag van de week | do |
| C | wanneer | ochtend |
| D | intensiteit (1 weinig, 2 matig, 3 ernstig) | 2 |
| K | medicatie (s = Sumatriptan, v = Voltaren, d = Dafalgan) | sv |
| L | oorzaak | lopen |
| M | opmerkingen | gisteren gaan lopen |

Kolommen E tot J (neus, snow, licht, …) en N blijven onaangeroerd.
Andere kolommen nodig? Pas `KOLOMMEN` aan bovenaan in `logic.js`.

## Online zetten via GitHub Pages (eenmalig)

> ⚠️ Zet **alleen de inhoud van deze map `app`** op GitHub. De map `doc` met je Excel-bestand
> hoort daar **niet** thuis: een gratis GitHub Pages-repository is openbaar.

1. Ga naar github.com → **New repository**. Naam: `my-health`, zichtbaarheid **Public**. Klik **Create repository**.
2. Klik op **uploading an existing file** en sleep alle bestanden uit deze map `app`
   (ook de map `icons`) in het venster. Klik **Commit changes**.
3. Ga in de repository naar **Settings → Pages**. Bij *Source*: **Deploy from a branch**,
   branch **main**, map **/ (root)** → **Save**.
4. Na een minuutje staat de app op `https://JOUW-GITHUB-NAAM.github.io/my-health/`.

In de Google Cloud-client moet bij *Geautoriseerde JavaScript-oorsprongen* staan:
`https://JOUW-GITHUB-NAAM.github.io` (zonder `/my-health` erachter).

## Eerste keer openen

1. Open de link in Chrome (gsm of laptop).
2. Vul in de instellingen in: je **Client-ID**, de **link naar je Google Spreadsheet**, en het tabblad `Opname`.
3. Bij de eerste ingave vraagt Google om aan te melden. Je krijgt de melding dat de app niet
   geverifieerd is: kies **Doorgaan** (het is je eigen app in testmodus) en vink toegang tot
   Google Spreadsheets aan.
4. Installeren:
   - **Android:** Chrome-menu ⋮ → **Toevoegen aan startscherm** / **App installeren**.
   - **Laptop:** in Chrome het installatie-icoon rechts in de adresbalk.

## Veiligheid

- In de code staan geen gegevens en geen geheimen. De Client-ID en de spreadsheet-link blijven alleen op je toestel.
- Toegang tot je spreadsheet krijg je alleen na aanmelden met jouw Google-account. Die toegang
  vervalt na een uur, daarna meld je je (met één tik) opnieuw aan.
- Via ⚙︎ → **Afmelden** trek je de toegang op dat toestel in.

## Een wijziging doorvoeren

Upload het aangepaste bestand opnieuw naar GitHub (zelfde naam = overschrijven). Wordt de oude
versie nog getoond? Sluit de app volledig af en open ze opnieuw.
