# Referentni konfiguratori (konkurencija)

Izvor: ručni prolaz kroz oba konfiguratora sa Claude browser ekstenzijom, 2026-09-03.
Screenshotovi početnog stanja: `comp-breuning.png`, `comp-fischer.png` (headless snimak).

> **Ključno otkriće:** Breuning i Fischer koriste **isti engine** — bela-label SaaS
> **Confmetrix** (`*.confmetrix.com`). Znači ovo je de-facto industrijski standard za
> nemačke burme-konfiguratore; ono što vidimo je Confmetrix "house style".
> Cena ide preko `…/gateway/api/integration/containers/{id}/price` (server-side, uživo).
> 3D: WebGL2 canvas, vlasnički model format (`.mmf` kod Breuning-a), **bez** glTF/`THREE`
> globala. URL se **ne menja** po koraku; perzistencija preko "Save/Load" ID koda.

---

## 1. Koraci — poređenje

| # | Breuning | Fischer | Naš konfigurator |
|---|---|---|---|
| — | (Model se ne bira — jedan generički par) | (isto) | **MODEL** (Ravna / Zaobljena / …sa kamenom) |
| 1 | Profile (20) | Profile (16) | **PROFIL** (4: Ravni/Zaobljeni/D/Okrugli) |
| 2 | Dimensions (width, height, size) | Abmessungen (width, height, size) | **ŠIRINA** (širina + debljina + veličina) |
| 3 | Material (alloy/color/surface/fineness/layout) | Material (color/surface/fineness/tones) | **MATERIJAL** + **ZAVRŠNA OBRADA** (2 koraka) |
| 4 | Grooves/layers | Fugen / Design (spojevi + stepenici) | — (v2, "žljebovi/dezen") |
| 5 | Diamonds (37 setting-a, grupe) | Diamanten (12 setting-a, free placement) | **DIJAMANTI** (v1: 1 flush kamen + pozicija) |
| 6 | Engraving (30 zn.) | Gravur (40 zn., laser/dijamant) | **GRAVURA** (≤30 zn., unutra/spolja) |

Navigacija kod oba: "nazad / dalje" + "Poništi poslednju akciju" + "Reset". Tabovi uvek
klikabilni (nema wizard-a koji blokira).

---

## 2. DIMENZIJE (najvažnije za našu formulu mase)

| | Breuning | Fischer | **Mi (seedovano)** |
|---|---|---|---|
| Širina | 3.00–12.00 mm, korak **0.50**, def 4.50 | 1.5–10.0 mm, korak **0.5**, def 5.0 | **3.0–8.0, korak 0.5, def 4.0** ✅ u skladu |
| Debljina/visina | 1.60–2.30 mm, korak **0.10**, def 1.60 | 1.1–2.6 mm, korak **0.1**, def 1.8 | **1.0–2.5, korak 0.1, def 1.4** ✅ |
| Veličina prstena | 44–76, korak 0.5 (unutrašnji obim) | 45–75, korak 0.5 (Ø 14.32–23.87 mm) | 44–68 EU, korak 1 → **promeniti na korak 0.5** |
| Kontrola | padajući meni (virt. lista) | padajući meni (virt. lista) | **klizač** (po mockup-u klijenta) — zadržati |
| Sistemi mere | Inner circ. / Diameter / English / US / Swiss | Ringweite / USA / Switzerland / UK | EU + prikaz Ø mm (dodati) |
| Auto ratio | checkbox "optimal width/height ratio" | checkbox "optimal width/height ratio" | dodati kao opciju kasnije |
| **Live presek** | crtež poprečnog preseka se menja sa W/H/profilom | isto | **DODATI** — SVG presek u ŠIRINA koraku |

Debljina-opseg je kod oba **dinamičan** (zavisi od širine/profila). Kod nas: za sad fiksan,
kasnije suziti po profilu.

---

## 3. PROFIL

- **Breuning: 20** — 12 "Breuning" (A, B, C, D, E, F, PR_016/017/020/028/063/068) + 8
  "Saintmaurice" (P1–P8). Prikaz: **crtež poprečnog preseka** (kontura, ne 3D). Neki
  posivljeni zavisno od materijala/dijamanata. Default **C**.
- **Fischer: 16** — top 8 (B, C, D, E, F, G, J, L) + "prikaži još" 8 (A, H, I, K, M, N,
  O, P). Samo slovne oznake. Default **C**.
- **Mi: 4** (Ravni, Zaobljeni, D-profil, Okrugli) — dovoljno za v1 (klijent ima Ravna/
  Zaobljena u CAD-u). **Prikazati kao SVG čip poprečnog preseka**, ne samo tekst.
  Proširenje biblioteke → v2 (roadmap "Tehnički dug").

Tooltip Breuning (dobar copy): *"Profil je oblik poprečnog preseka prstena. Unutrašnja
zakrivljenost ('comfort') utiče na udobnost nošenja; zaobljene ivice → lakše klizi preko
prsta."*

---

## 4. MATERIJAL + ZAVRŠNA OBRADA

| | Breuning | Fischer | **Mi** |
|---|---|---|---|
| Metali/boje | 6: Yellow/White/Gray/Red gold, Platinum, Tantalum | 9: Yellow/Apricot/Caramel/Rose/Grey/White gold, Palladium, Platinum, FischerCarbon® | **3: Žuto/Belo/Crveno zlato** (iz klijentovih V-Ray fajlova) |
| Finoća | 333/375/585/750 (zavisi od metala) | po metalu (Pt 600/950; Rose 375/585/750) | fiksno **585** → napraviti izbornu (utiče na gustinu → masu → cenu) |
| Površine/finiši | **16** (Polished, Fine/Coarse-sanded, Brushed ×3, Ice/Crystal/Wood grain/Diamond grain/…, Hammered) | **12** (Poliert, Eismatt, Exklusivmatt, Feinmatt, Rinde, Quermatt, Sandmatt, Hammered, …) | **3: Polirano / Mat / Grebano** (iz V-Ray glossiness) |
| Više boja | Single / Two (10 var.) / Three (14 var.) / Free / Inlay / Blended Waves | 1 / 2 (2:1) / 3 tona + 6 uzoraka (1:1, 2:1, 3:1, talas, dijagonala) | — (v2, "dvobojni prsten") |

Za v1 ostajemo na klijentovoj stvarnoj ponudi (3×3). **Finoća** je bitna jer menja
`density` u formuli — dodati kao izbor (npr. 585 / 750) sa različitom gustinom i cenom/g.

---

## 5. DIJAMANTI — pun opseg konkurencije (za v2 plan)

### Breuning
- **"Diamond group"** — može **više nezavisnih grupa** kamenova po prstenu (+Add group).
- **Setting type modal: 37 tipova / 7 kategorija:**
  - *Bezel:* Bezel, Bezel (crosswise/right/left), Free stones, Templates, Engagement version
  - *Bead:* Bead, Bead (crosswise/right/left)
  - *Channel:* Channel, Channel (crosswise/right/left/around entire ring/oblique)
  - *Tension style:* (crosswise/oblique/convex-concave/concave)
  - *Eye:* (lengthwise/crosswise/diagonal)
  - *Chaton (pojedinačni):* 4-prong V1/V2, 6-prong V1/V2, Carree V1/V2, frame, 4-piece prong
  - *Memoire (pun red):* Eternity Ring 1/2, Memoire 3/4/5
- Cut: Brilliant, Princess, Baguette (+ Navette, Heart sivi)
- Stone size: **~0.0055–1.0 ct**, nelinearni korak (fini na malim, krupni na velikim)
- Quality: H/si, G/if, Black (+ fancy: Cognac, Forest green, Purple)
- Rows: 1–2 (bočne rešetke) · Number of stones: One-third (15) / Half (22) / Whole (44) /
  tačan broj; checkbox "Use Memoire on both sides"
- Pozicija: implicitna (tip × redovi × broj), nema zaseban unos koordinata

### Fischer
- **Setting type: 12 tipova:** Keine, Eingerieben (flush), Verschnitt, Kanal, Kanal quer,
  **Freie Platzierung**, Seitl. eingerieben (l/r), Seitl. Verschnitt (l/r), Spannring
  (tension), Zarge (bezel). *Nema klasičnih kandži.*
- Herkunft: Naturdiamanten / Labordiamanten
- Quality/Color: 12 (G/SI, G/VSI, G/IF, G/VVSI, H/SI + fancy: Ocean blue, Canary, Gold,
  Cognac, Forest green, Black, Berry red)
- Cut: Brillant, Princess, Baguette
- Diamond size: **0.01–0.37 ct**, nejednaki koraci (0.01 → 0.02 → 0.01), veće onemogućene
- Number of stones: **1–36** + preset "ringsum (36) / Halber Ring (18) / Drittel (12)"
- **Position: 5** — left / center / right / Free placement / Centered on disc 1
- **"Freie Platzierung"** = poseban ekran:
  - 2D razvijena mapa trake (uglovi 0°/45°/…/315° na y-osi)
  - tabela: Stone size (ct) | Position X (mm) | Position Y (mm) | Delete
  - "Add stone" → bela tačka koja se **prevlači** po mapi; svaki kamen svoja veličina/kvalitet
  - **17 gotovih "scatter" šablona** (Designvorschläge / Schablonen)
- "Diamant im Ringinnern" (skriveni kamen u traci) — checkbox u koraku GRAVURA (+~29 €)

### → Naš plan
- **v1:** jedan flush okrugli kamen — biraš **tip postavke / krunicu** prvo (uklj. "Bez
  dijamanta", oba konkurenta počinju od "ništa"), tek onda **veličinu** (0,005/0,015/0,03
  ct, seedovano — karati kao kod oba konkurenta, ne mm, #64) + **poziciju** (klizač,
  `posRange` −10…+10 mm od 12h). Stock-gated.
- **v2 (roadmap "Tehnički dug"):** tip rešetke (flush / kanal / bezel / bočno), red/pavé
  sa brojem kamenova (preset trećina/pola/ceo + tačan broj), "free placement" sa 2D mapom
  i drag tačkama + šabloni, cut (brilliant/princess/baguette), kvalitet/fancy boje,
  lab vs natural, više grupa po prstenu.

---

## 6. GRAVURA

| | Breuning | Fischer | **Mi** |
|---|---|---|---|
| Max znakova | 30 | 40 | seedovano 20 → **podići na 30** |
| Fontovi | 5 (npr. "Frankfurt Gothic Kursiv") | ≥5 (Shelly Allegro, Bernhard Modern, Gando, Fine Hand…) | 2 (serif, script) → dodati par |
| Pismo | Standard / Greek / Russian (laser) | — | latinica (v1); ćirilica kasnije |
| Simboli | 8 (srce, kupidon, dupla srca, sunce, krst, prstenovi, ∞) | 4 (♡, prstenovi, ribbon, ∞) | dodati ~5 (v2) |
| Unutra/spolja | podrazumevano unutra | unutra; "Lasergravur außen" u Sondergravur | **imamo inside/outside** ✅ |
| Tehnike | laser (uklj.) | **Lasergravur** vs **Diamantgravur** (doplata) | samo laser (v1) |
| Specijalno | Facsimile (potpis) + Fingerprint | Handschrift + Fingerabdruck + spoljni laser | v2 |
| Doplata | osnovni tekst uključen | osnovni uključen; specijalno naplaćeno | seedovano flat 3000 → razmisliti (možda uključeno) |

---

## 7. PAR PRSTENOVA (Njena / Njegova)

- **Breuning:** tabovi Ring 1/Ring 2 (dole) + "+". Nema jednog katanca — **svaki korak ima
  svoj checkbox "Apply settings of ring X"**; auto-isključi se kad se prstenovi razlikuju.
  Modal "Add or remove rings" dozvoljava **>2 prstena**.
- **Fischer:** tabovi Ring 1/Ring 2 (gore) + **katanac = samo uporedni prikaz** (2 kolone),
  NE sinhronizuje vrednosti.
- **→ Mi:** tabovi "Njena burma" / "Njegova burma" (imamo). Dodati **"primeni na oba"** po
  sekciji (Breuning-stil). ">2 prstena" nije potrebno za burme.

---

## 8. CENA

- Oba: **uživo, po prstenu + ukupno**, server-side API (Confmetrix `/price`).
- Fischer JSON: `{"rings":[{"result":1113,"name":"Ring 1"},{"result":880,"name":"Ring 2"}],
  "totalPrice":1993, "currency":{"symbol":"€","thousands":".","format":"%v,-%s","precision":0}}`
- **→ Mi:** trenutno pokazujemo samo "za par". **Dodati red po prstenu** (Njena / Njegova /
  Ukupno). Format RSD: `89.500 RSD` (tačka = hiljade), bez decimala.

---

## 9. Tehnički zaključci

| | Breuning | Fischer |
|---|---|---|
| Engine | **Confmetrix** (`assets.confmetrix.com`, `breuning-universal-package`) | **Confmetrix** (`fischer-v2.services.confmetrix.com`) |
| 3D | WebGL2 canvas, 1 `<canvas>`, bez `THREE`/`BABYLON` globala | isto (WebGL2, ANGLE/D3D11) |
| Model format | vlasnički `.mmf` (npr. `drill-round-rubbed-edge.mmf`), **ne glTF**, bez `.wasm` | nije uhvaćen (verovatno isto) |
| Env mapa | `data/environments/MapA_v5.jpg` (refleksije) | — |
| Fontovi za 3D | `arial_narrow.ttf`, `fonts.cdn.confmetrix.com` | — |
| Deep-link | **nema** — URL fiksan; perzistencija preko "Ring-ID" (Save/Load) | **nema** — isto; container ID = server sesija |
| Price API | `POST …/json-rpc` + `GET …/containers/{id}/price?priceCalculationMode=vk&goldAccount=false` | `GET …/containers/{id}/price?language=de&currency=EUR&version=shop` |

**Za nas:** potvrđeno da je real-time WebGL industrijski standard → naš three.js + proceduralni
shank plan je ispravan. Prednosti koje možemo da damo a oni nemaju: **deep-link URL**
(deljiva konfiguracija bez ID koda), **otvoreni glTF/Draco pipeline**, lakši plugin.

---

## 10. Šta konkretno menjamo u našem konfiguratoru

1. Veličina prstena: korak **0.5** (ne 1), prikaz Ø mm pored EU broja.
2. ŠIRINA korak: dodati **live SVG crtež poprečnog preseka** (menja se sa širinom/debljinom/profilom).
3. PROFIL: čipovi = **SVG crtež preseka**, ne tekst.
4. Finoća materijala: napraviti izbornu (585/750…) jer menja `density` → masu → cenu.
5. Cena: prikaz **po prstenu + ukupno**, ne samo "za par".
6. Gravura: max **30** znakova; +par fontova; +nekoliko simbola (v2).
7. "Primeni na oba prstena" po sekciji (Njena ↔ Njegova).
8. Undo / Reset dugmad; kasnije Save/Load + Podeli + PDF (Faza 5).
9. DIJAMANTI v2 backlog: vidi §5 → prebačeno u `docs/roadmap.md` "Tehnički dug".
