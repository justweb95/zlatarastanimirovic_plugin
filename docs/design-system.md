# Dizajn sistem

Izvor: Figma **"Stanimirović - konfigurator"** (`6Vahmm3L5YQIDWeQwqVDeL`), node-ovi
`1:8` boje · `1:9` tipografija · `1:10` ličnost brenda · `1:11` komponente · `1:12` spacing.
Screenshotovi u `docs/reference/`. Vrednosti hex/tekst su iz same Figme; **px veličine fontova su procena** dok se ne izvuku iz Dev Mode-a.

---

## Ličnost brenda — 7 karakteristika

> Svaka odluka u interfejsu (razmak, boja, ton teksta) treba da potvrđuje jednu od ovih.

| # | Osobina | Značenje u UI |
|---|---|---|
| 1 | **Precizna** | Poravnanje, brojevi, mere — sve tačno, bez slučajnosti |
| 2 | **Topla** | Bela nikad hladna — uvek sa tonom slonovače ispod |
| 3 | **Bezvremenska** | Nema trend-boja ni efekata koji zastarevaju za godinu dana |
| 4 | **Rafinirana** | Tanke linije, umerene senke, ništa upadljivo |
| 5 | **Zanatska** | Detalji (profil, finiš) prikazani realno, kao kod pravog zlatara |
| 6 | **Lična** | Gravura i par prstenova (Njena / Njegova) uvek jasno obeleženi |
| 7 | **Samouverena** | Jedan jasan CTA po ekranu, bez agresivnog prodajnog tona |

---

## Boje

> Sajt ostaje 75–85% bele/neutralne površine. Zelena i braon se koriste **strateški, kao akcenti koji vode oko**, ne kao pozadina.

| Token | Hex | Uloga | Budžet površine |
|---|---|---|---|
| `--zs-green` | `#1F3D2E` | Primarna — CTA, selektovano, aktivni koraci | ~5–8% |
| `--zs-green-hover` | `#16291F` | Hover primarnih dugmadi | — |
| `--zs-success` | `#3E6E52` | Potvrde ("dodato u korpu") | — |
| `--zs-bronze` | `#8B5A34` | Sekundarna — hover, ikone, tekst-linkovi, detalji | ~3–5% |
| `--zs-gold` | `#B8974F` | Vrlo suptilno — premium bedž, deliteri | <1% |
| `--zs-bg` | `#FFFFFF` | Glavna pozadina (čisto bela — client 2026-09-06, videti decisions.md #26) | ~55–60% |
| `--zs-surface` | `#F7F7F5` | Sekcije, kartice, selektovano stanje (neutralno svetlo sivo) | ~20% |
| `--zs-surface-2` | `#ECECE8` | Podloge, tag-ovi, razdelnici | ~10% |
| `--zs-border` | `#E3E3DF` | Linije, konture kartica i input-a (1px) | — |
| `--zs-text` | `#221F1B` | Naslovi, primarni tekst | — |
| `--zs-text-muted` | `#7C7568` | Opisi, labele, meta-podaci | — |
| `--zs-disabled` | `#C7C0B0` | Neaktivne opcije | — |

```css
:root {
  --zs-green:        #1F3D2E;
  --zs-green-hover:  #16291F;
  --zs-success:      #3E6E52;
  --zs-bronze:       #8B5A34;
  --zs-gold:         #B8974F;
  --zs-bg:           #FFFFFF;
  --zs-surface:      #F7F7F5;
  --zs-surface-2:    #ECECE8;
  --zs-border:       #E3E3DF;
  --zs-text:         #221F1B;
  --zs-text-muted:   #7C7568;
  --zs-disabled:     #C7C0B0;
}
```

> **2026-09-06 white refresh**: client felt the original warm cream/ivory (`#FBF9F4`/`#F5F0E6`) read as "yellowish" — flattened to clean white + neutral light-grey surfaces (values above). Green/bronze/gold accents untouched. Point 2 ("Topla — bela nikad hladna, uvek sa tonom slonovače ispod") in the ličnost-brenda table above is superseded by this — kept the row rather than rewritten, since it documents the original Figma read.

Pravilo: **selektovano stanje mora biti uočljivo bojom (zelena), nikad samo senkom.**

---

## Tipografija

Dva fonta (oba Google Fonts, besplatni):

- **Fraunces** — editorijalni serif. Nosi karakter brenda: **display/H1–H3, cena, imena modela**.
- **Inter** — UI sans. Sve tehničke/funkcionalne stvari: **opcije (materijal, profil, širina, finiš), body, labele, dugmad, tehnički mikro-tekst**.

| Token | Font | Weight | Size (approx) | Case / napomena |
|---|---|---|---|---|
| `display` / H1 | Fraunces | 400 (opsz high) | ~48px | naslovi stranice |
| `h2` | Fraunces | 500 | ~30px | "Materijal i finiš" |
| `h3` | Fraunces | 600 | ~22px | "Izaberite profil" |
| `price` | Fraunces | 500 | ~28px | "89.500 RSD" / "142.000 RSD" |
| `body-lg` | Inter | 400 | ~18px | uvodni tekst |
| `body` | Inter | 400 | ~16px | `--zs-text-muted` |
| `button` | Inter | 600 | ~15px | — |
| `label` / eyebrow | Inter | 600 | ~12px | UPPERCASE, letter-spacing ~0.08em, `--zs-bronze` |
| `micro` | Inter | 400 | ~13px | "Ø 52 mm · 14K · 2.4 mm", `--zs-text-muted` |

```css
:root {
  --zs-font-serif: "Fraunces", Georgia, "Times New Roman", serif;
  --zs-font-sans:  "Inter", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
}
```

> px vrednosti su procena iz screenshotova — potvrditi u Figma Dev Mode i onda zaključati u tokene.

---

## Spacing i grid

| | Vrednost |
|---|---|
| Max širina sadržaja | **1600px** (bilo 1440 — prošireno 2026-09-08, decisions #44) |
| Grid konfiguratora | **1fr / 380px** (3D viewport · desni panel opcija — `--zs-panelw`, bilo 300/320; leva lista modela uklonjena 2026-09-06, decisions #26) |
| Header | svi tekstovi **13px**, logo **height 55px** (decisions #44) |
| Spacing skala | **4 · 8 · 12 · 16 · 24 · 32 · 48 · 64** |
| Padding kartice | 16–20px |
| Razmak sekcija | 32–40px |
| Border radius | **8–12px** (dugmad/input/kartice) · **50%** (swatch) |
| Border | `#E2DBCB` · **1px** |
| Ikone | 18px (inline) · 20px (u dugmadima) |
| Senke | suptilne, umerene — nikad kao primarni signal stanja |

```css
:root {
  --zs-space-1: 4px;  --zs-space-2: 8px;  --zs-space-3: 12px; --zs-space-4: 16px;
  --zs-space-5: 24px; --zs-space-6: 32px; --zs-space-7: 48px; --zs-space-8: 64px;
  --zs-radius: 10px;  --zs-radius-pill: 999px;
  --zs-maxw: 1600px;         /* bilo 1440 (decisions #44) */
  --zs-panelw: 380px;        /* desni panel opcija */
  --zs-grid: 1fr var(--zs-panelw);
}
```

---

## Komponente

Opšte: tanki elegantni border-i, suptilne senke, umeren radius (8–12px), generozan razmak.

| Komponenta | Spec |
|---|---|
| **Primary dugme** | fill `--zs-green`, tekst beli, radius ~8px, ikona 20px; hover → `--zs-green-hover` |
| **Secondary dugme** | belo, 1px `--zs-border` (ili tamni border), tekst `--zs-text` |
| **Tekst-link dugme** | `--zs-bronze`, podvučeno ("Podeli dizajn") |
| **Icon dugme** | kružno, outline, 1px border, ikona 18–20px (reset, zoom, rotate) |
| **Kartica — stanja** | *Podrazumevano*: 1px `--zs-border` · *Hover*: border `--zs-bronze` · *Izabrano*: border `--zs-green` + fill `--zs-surface` · *Nedostupno*: `--zs-disabled`, faded, ne-klik |
| **Swatch metala** | kružić 50%, metalik gradijent; selektovan = zeleni prsten oko njega + ✓ |
| **Profil kartica** | kartica sa SVG poprečnim presekom (`crossSectionPath`) + labelom; 14 profila u 4 grupe sa eyebrow naslovom po grupi (decisions #44) |
| **Step indicator** | kružići: *completed* ✓ outline · *active* fill `--zs-green` sa brojem · *pending* svetli; spojeni 1px linijom |
| **Prekidač burmi** | ♂ / ♀ kružna dugmad u donjoj toolbar traci (bilo tabovi iznad viewporta); izabran = fill `--zs-green`. Pored: „oko" dugme = prikaži samo aktivnu burmu (decisions #44) |
| **Akordeon** | header sa `›` chevron; strogi single-open (decisions #43); footer: „Primeni na drugu burmu" (dashed) + „Sledeće: …" |
| **Žlebovi korak** | tab traka (underline) · mreža kartica oblika · red „N žleb(ova)" + „Ukloni sve" + zeleno „Dodaj žleb" · kartica po žlebu = numerisani head + labelirani redovi (dropdown Oblik/Površina/Širina/Dubina · pill Orijentacija · broj Pozicija) — po Breuning „Fugen/Stufen" (decisions #47) |
| **Tooltip** | taman bubble (`~#221F1B`), beli tekst, mali radius ("Mera obima prsta u mm") |
| **Cena kartica** | label "CIJENA ZA PAR" (`label` stil) + iznos (`price` stil, Fraunces); valuta **RSD** |
| **Slider (širina)** | track `--zs-border`, filled deo `--zs-green`, handle `--zs-green`; oznake koraka ispod (2–6 mm) |

---

## Rekonsilijacija sa konfiguratorom (iz mockup-a `configurator-mockup.png`)

> **Superseded 2026-09-06** (decisions.md #26): koraci su sada `PROFIL · DIMENZIJE ·
> MATERIJAL · ŽLEBOVI · DIJAMANTI · GRAVURA` — nema više zasebnog "MODEL" koraka
> (PROFIL ga zamenjuje kao ulazna tačka, prikazan kao kartice sa slikom preseka +
> tekstom), "ZAVRŠNA OBRADA" je uklopljena u MATERIJAL, dodat je ŽLEBOVI korak. Red
> ispod ostaje kao istorijski zapis originalnog Figma mockup-a.

- **7 koraka**, ne 8 (originalni mockup, pre 2026-09-06 restrukture — vidi napomenu iznad): `MODEL · MATERIJAL · PROFIL · ŠIRINA · ZAVRŠNA OBRADA · DIJAMANTI · GRAVURA`.
- **PROFIL** je diskretan izbor (Okrugli / D-profil / Ravni / Komfort), ne klizač. **ŠIRINA** je klizač (2–6 mm). Body-tekst tipografskog lista pominje i "debljinu" ("Izaberite širinu i debljinu prstena.") — potvrditi da li je debljina zaseban parametar ili je implicirana profilom.
- **Par prstenova** ("Njena burma" / "Njegova burma") — dve nezavisne konfiguracije sa tabovima; cena je "ZA PAR".
- **Materijali**: Belo zlato 14K · Žuto zlato 14K · Roze zlato 14K · Platina 950 · Palladium 950.
- **Završna obrada**: Polirano · Mat · Brušeno · Čekićano.
- Valuta: **RSD** (mockup ponegde pokazuje €, ali tipografski/komponente listovi koriste RSD — RSD je merodavno).
- Mockup pokazuje "DODAJ U KORPU" + "ZAKAŽI TERMIN" — v1 prodajni model je i dalje **email konfiguracije** (vidi `decisions.md` #13); dugmad se mogu relabelirati.
