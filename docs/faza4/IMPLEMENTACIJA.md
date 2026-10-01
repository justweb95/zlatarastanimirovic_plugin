# Faza 4 — implementacija u pluginu (v0.8.0, 2026-10-01)

Paket: `FAZA4-metali-i-zlebovi.md` + `reference/wamaMetalsGrooves.js`. Odluka: `docs/decisions.md` #78.
Grana: `faza4-metali-zlebovi`.

## 1. Gde je šta u pluginu

| Tema | Fajl | Funkcije |
|---|---|---|
| Profil (Faza 3) | `assets/js/ring-geometry.js` | `wamaSpec`, `wamaHalf`, `wamaSectionLoop`, `wamaMinH`, `baseLoop` |
| Katalog žlebova/ivica/razdvajanja | `ring-geometry.js` | `GROOVE_FORMS`, `EDGE_FORMS`, `SEPARATION_*`, `grooveDefaults`, `vDepth` |
| Presek sa žlebovima | `ring-geometry.js` | `splitLoop`, `grooveOutline`, `edgeStepLeft`, `buildSection`, `beadRow` |
| Podela boja | `ring-geometry.js` | `DIVISIONS`, `divisionOf`, `presetCuts`, `boundaryAt`, `wavePctAllowed` |
| Zapremina / masa | `ring-geometry.js` | `bandVolumes`, `ringVolume`, `grooveRemoved` |
| Pravila (pozicija, dubina, klasa) | `ring-geometry.js` | `freeIntervals`, `autoGroovePos`, `placeGroove`, `minWall`, `depthAllowed`, `priceClass` |
| 3D | `assets/js/scene.module.js` | `getAtlas` (LUT atlas), `createLutMetalMaterial` (trake, talas, rez talasastog žleba), `makeBandGeometry`, `sweepGeometry`, `latheLoop`, `buildBeadsFor`, `applyZones` |
| UI | `assets/js/configurator.js` | `uiMaterijal`, `setDivision`, `fixFinoca`, `uiGrooves` → `uiDesignGrooves` / `grooveItem` / `uiSeparation` / `uiEdges`, `grooveSectionSVG`, `normalizeRing`, `geoOf` |
| Cena | `configurator.js` | `_ringPrice`, `bandVolumes` |
| CMS: finoće, gustine, cene/g, doplate klase, rodijum | `src/Data/Settings.php` (`default_finoce`, `rodijum`), `src/Admin/Screen.php` (Podešavanja) |
| CMS: metali | `src/Data/Seeder.php` (redovi `material`: `params.lut/rhodium/combinable`, `price_json.surcharge_flat/surcharge_per_gram`), `Screen.php` (forma materijala) |
| Payload | `src/Data/Compiler.php` (`pricing.finoce`, `pricing.rhodium`) |
| Nadogradnja postojećih podataka | `Seeder::upgrade_v3()` (`zs_data_version` = 3) |

## 2. Razlike naš ↔ Wama

### §22 Metali

| Wama | Mi (v0.8.0) | Napomena |
|---|---|---|
| 5 legura: yellow, white (Ni), red, manganese, white-pd | `zuto`, `belo`, `crveno`, `manganovo`, `belo-pd` | iste LUT boje (Faza 2) |
| finoće 333/375/585/750 | 333/375 (isključene), 585, 750 (+ naše 916/999 isključene) | admin uključuje |
| gustine 10,9/11,2/13,3/15,5; Mn 12,2; Pd 14,8 | iste (CMS, po finoći i metalu) | ranije 13,07/12,9/13,0 i 15,55/15,9/15,45 |
| Mn i Pd samo 585 | gustina 0 u drugim finoćama → finoća se prebacuje | |
| cena/g po klasi (simple/special/multi/wavy) | cena/g + „doplata klase“ po finoći (CMS) | 0 = bez doplate |
| Mn +50 po prstenu, Pd +50/g | „Doplata po prstenu“ / „po gramu“ na metalu (CMS) | |
| rodijum samo belo, +50, bez vizuelne promene | isto (CMS iznos), bez promene LUT-a | |
| vk = 2,46 × ek | nema — CMS cene su već prodajne | |
| površina po traci, doplata jednom | obrada po prstenu, doplata jednom | razlika samo u UI |
| manganovo u višebojnom → ceo prsten manganovo | manganovo onemogućeno u višebojnom | jasniji UX |
| platina, srebro, rutenijum: nema | nema | |

### §23 Žlebovi

| Wama | Mi | |
|---|---|---|
| 7 oblika, liste mera | isti oblici i liste | ranije 5 izmišljenih oblika, slobodne mere |
| V: širina ↔ dubina vezano uglom | isto | |
| U: 7 preseta | isto (filtrirano po mestu i dubini) | |
| kvadratni: širina × dubina nezavisno, kosina 0,1 | isto | |
| perlaž: kanal 0,1 + kuglice 7/9·w | isto, kuglice instancirane | oblik kuglice ESTIMATED |
| pozicija = centar, mm od leve ivice, 0,01 | isto | ranije „od centra“, korak 0,05 |
| ≥ 0,5 mm od ivice i drugog žleba, pomeri/odbij | isto (+ ivice i ravni razdvajajući žleb kao prepreke) | |
| auto pozicija | isto (2,5 → 3,8 → 1,2 → nema mesta) | |
| dubina ≤ ½ zida | isto; postojeći žleb se smanjuje/uklanja kad prsten postane tanji | Wama UNKNOWN |
| projekcija na profil (V/kv. radijalno, U/ispupčeni rotirani) | isto (tačna konstrukcija) | ranije radijalno guranje temena |
| samo polirano, 360°, bez umetka | isto; uklonjeni „Površina“ i „Orijentacija“ | |
| razdvajajući žleb na svakoj granici | isto, tab „Granice boja“ | ranije placeholder |
| ivica normal / perlaž | tab „Ivice“ | ranije „Slojevi“ placeholder |

### §25 Spec za nas

| Stavka iz §25 | Urađeno |
|---|---|
| CMS polja metala (`colorId`, label, fineness, density, pricePerGram po klasi, surchargeFlat/PerGram, allowRhodium, rhodiumSurcharge, canCombine, allowedFinenesses) | da — `params.lut`, naziv, finoće u Podešavanjima (gustina 0 = nije dozvoljeno), cena/g + klase, doplate, `rhodium`, `rodijum`, `combinable`. `composition` nije dodat (nije potreban za prikaz/cenu). |
| Shader zavisi samo od boje | da (LUT atlas, finoća ne menja izgled) |
| Masa = Σ V_trake · ρ_trake | da |
| Klasa cene, ne sabiraju se | da (`priceClass`) |
| Višemetalni: trake + division {type, rates, cuts, pct, cycles} | da (`state.division`, `bandMetals`, `rhodium[]`) |
| Žleb JSON {form, position, width, depth} | da (`{form, pos, width, depth}`) + `edges`, `separation` |
| Pozicioniranje (slajder, validacija, pomeri/odbij, auto) | da |
| Konstrukcija na profilu | da (`buildSection`) |
| Filtriranje dubina i U preseta | da |
| Segmentacija: žleb nosi metal trake; razdvajajući deli dve polovine | da (boja po fragmentu iz pozicije) |
| Zapremina žleba / masa traka | da, tačno (talas: integral po φ) |
| Preporuka: stvarna masa + rad kroz klasu | da |

## 3. §24 reprodukcija (`tools/check_prices_browser.mjs`)

Wama cene (PLN) unete kao naše CMS vrednosti (cena/g po finoći, doplate klasa
13/27/56 itd., Mn 50, Pd 50/g, rodijum 50, „mat“ = hammered 80); masa po Wama
pravilu (puna, bez žlebova) da bi se uporedila formula. „Stvarno“ = naša masa.

| Slučaj | Klasa | Masa (Wama) | Prikaz (Wama) | Stvarna masa → prikaz |
|---|---|--:|--:|--:|
| P1 5×1,5 žuto 585 | simple | 6,5609 (6,5609) | 5988 (5988) | 6,5609 → 5988 |
| žuto 333 | simple | 5,3770 (5,3770) | 3135 (3135) | 5,3770 → 3135 |
| žuto 750 | simple | 7,6462 (7,6462) | 8634 (8634) | 7,6462 → 8634 |
| belo 585 + rodijum | simple | 6,5609 | 6111 (6111) | 6,5609 → 6111 |
| manganovo 585 | simple | 6,0183 (6,0183) | 5616 (5616) | 6,0183 → 5616 |
| belo Pd 585 | simple | 7,3009 (7,3009) | 7561 (7561) | 7,3009 → 7561 |
| žuto 585 čekić | simple | 6,5609 | 6185 (6185) | → 6185 |
| P1 8×1,5 čekić | simple | 10,5537 (10,5537) | 9829 (9829) | → 9829 |
| V90 0,2 | simple | 6,5609 | 5988 (5988) | 6,5514 → 5979 |
| V60 0,5 | special | 6,5609 | 6198 (6198) | 6,4594 → 6102 |
| U 1,2 × 0,6 | special | 6,5609 | 6198 (6198) | 6,0253 → 5692 |
| 333 kvadratni 0,3 × 0,05 | special | 5,3770 | 3347 (3347) | 5,3576 → 3334 |
| vertical-1-1 žuto/belo | multi | 6,5609 | 6424 (6424) | 6,5514 → 6414 |
| wave-1-1 30 % 2 | wavy | 6,5609 | 6892 (6892) | 6,5514 → 6882 |
| 750 vertical-1-1 | multi | 7,6462 | 9085 (9085) | 7,6351 → 9072 |
| vertical-1-1 žuto/Pd | multi | 6,9309 (6,9310) | 7235 (7235) | 6,9209 → 7224 |
| čekić + belo/rodijum 1-1 | multi | 6,5609 | 6743 (6743) | 6,5514 → 6734 |
| P1 6×1,5 1-2-1 Ž/Pd/C + ivice | multi | 8,3421 (8,3422) | 8714 (8714) | 8,3097 → 8681 |
| P16 6×2 V90+ispupčeni+perlaž (bez kamena) | special | 9,3175 (9,3206) | 8802 (8805) | 9,1139 → 8609 |

18/18 tačno; P16: poznata razlika modela profila iz Faze 3 (FAZA4 §24 navodi isto: 9,3177).

Geometrija (`tools/check_ring_geometry.mjs`, Node): obris svakog oblika = referentna
konstrukcija (≤ 0,0003 mm), uklonjena zapremina = tabela §17, trake 3,2805 / 1,9496,
broj kuglica 79 / 103 (Wama 104), pravila pozicije i dubine kao Wama.

## 4. Testovi

```
node docs/faza4/tools/check_ring_geometry.mjs                    # Node, bez browsera
PLAYWRIGHT_CORE=<scratch>/node_modules/playwright-core/index.mjs node docs/faza4/tools/check_prices_browser.mjs
```
