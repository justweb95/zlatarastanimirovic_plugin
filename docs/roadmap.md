# Roadmap

Faze su inkrementalne; svaka se može demonstrirati. Acceptance = merljiv kriterijum.

## Faza 0 — Temelji
- [x] Dev WP + tema (sandbox)
- [x] Docs (`architecture`, `data-model`, `3d`, `decisions`, `roadmap`, `design-system`)
- [x] Dizajn sistem iz Figme izvučen (paleta, Fraunces+Inter, komponente, grid) → `design-system.md` + `docs/reference/`
- [ ] `tokens.css` (CSS custom properties iz `design-system.md`) + Fraunces/Inter self-host ili Google Fonts
- [ ] Tačne px veličine tipografije iz Figma Dev Mode → zaključati u tokene (pitanje H)
- [ ] Plugin skeleton: `zs-configurator.php` header, folderi, lenja hook registracija
- [x] Zaseban git repo za plugin + `.gitignore` (`app/node_modules`, `app/dist`, `vendor`)
- [ ] `app/` Vite projekat (prazan mount u div)
- [ ] CDN bucket + upload skripta (posle odluke C)

**Acceptance:** plugin se aktivira bez greške; shortcode `[zs_configurator]` ispiše prazan mount div; `app/dist` bundle se učita SAMO na toj stranici (provereno: 0 bajtova drugde).

## Faza 1 — Data layer
- [ ] `wp_zs_options` tabela + migracija (dbDelta)
- [ ] Admin stranica, **Tab 2 "Opcije"**: CRUD nad 7 grupa, `enabled`/`available`/`stock`, sort, `price_json`/`params_json`/`compat_json` editori
- [ ] `zs_settings` (spot cene metala po finoći, HDRI URL, CDN baza, email primaoci)
- [ ] Kompajler: opcije → normalizovan JSON (razrešena kompatibilnost + `available`)
- [ ] `GET /wp-json/zs/v1/config?model=slug` + transient keš + ETag/304
- [ ] Admin **Tab 1 "ERPNext"**: polja API URL/key/secret + [Sync now] dugme (stub koji samo loguje)

**Acceptance:** izmena opcije u adminu → za < 1s vidljiva u `GET /config`; payload < 50 KB gz; drugi poziv vraća 304.

## Faza 2 — 3D jezgro

### 2a — proceduralno jezgro (vanilla three.js) — U TOKU
- [x] three.js **spakovan lokalno** (`assets/lib/three/`, r0.169) + import map iz shortcode-a
- [x] `assets/js/scene.module.js`: renderer (`frameloop="demand"`), kamera, OrbitControls (damped, idle auto-rotacija)
- [x] Studio svetlo: `RoomEnvironment` → PMREM, `ACESFilmicToneMapping`; ground `ShadowMaterial` (kontakt senka) + 1 directional key light
- [x] Proceduralni shank: `LatheGeometry` (profil-presek → obrtanje oko ose prsta), live regen na klizače width/thickness/size
- [x] 4 profila (`flat`/`court`/`d-comfort`/`round`) → funkcije koje vraćaju presek
- [x] Materijali: 3 zlata × 3 finiša (boja + roughness iz V-Ray vrednosti), cross-fade lerp
- [x] Flush kamen — **fasetiran round brilliant** (`makeBrilliantGeometry`, 12 strana, per-faseta normale = sjaj), flush na SPOLJNU površinu, `scale` ograničen na debljinu trake da kulet ne probije unutrašnji zid; pozicija po širini (Levo/Centar/Desno/Slobodno) (2026-09-09, decisions #46/#47)
- [x] DPR cap (≤2), `ResizeObserver`, fallback na render sliku ako nema `ZSCScene`
- [x] Rail/toolbar: auto-rotacija, reset pogleda, zoom ±, screenshot, pun ekran
- [x] Šav na `LatheGeometry` — `weldLatheSeam()` (2026-09-04)
- [x] Prikaz oba prstena istovremeno + **♂/♀ prekidač u toolbaru + „vidi samo jednu"** (`setSolo`, isti kadar) (2026-09-08, decisions #44)
- [x] **14 profila u 4 grupe** kroz jedan parametarski generator (`paramProfileOutline`) koji hrani i 2D crtež i 3D `LatheGeometry` (2026-09-08, decisions #44)
- [x] **Finoća 585/750** → `density` → masa + produbljena boja (2026-09-08, decisions #45)
- [x] **Gravura vidljiva u renderu** — aproksimacija: tamna slova na tankom cilindru uz zid trake, Unutra/Spolja (2026-09-08/09, decisions #46/#47). Pravo urezivanje (canvas→height/normal) = Faza 3.
- [x] **Žlebovi**: „Pozicija" stvarno pomera greben po širini; korak-UI preuređen po Breuning „Fugen/Stufen" (decisions #46/#47)
- [ ] Normal mape za "Grebano" (anizotropno) i "Čekićano"; brušeni pravac
- [ ] `dispose()` na unmount — delimično (gravura/žlebovi se čiste; band/mat dispose još nije zakačen za unmount); WebGL2 fallback poruka

### 2b — Svelte UI ljuska + Vite build
- [ ] `app/` Vite + Svelte projekat; migracija panela iz `assets/js/configurator.js`
- [ ] `app/dist` → PHP enqueue umesto trenutnih vanilla asseta
- [ ] state store (Svelte), deep-link URL ↔ konfiguracija

**Acceptance:** klizači menjaju geometriju live bez frame drop-a; promena metala instant; 60 fps na test Androidu; render staje kad nema interakcije.

## Faza 3 — 3D sadržaj
- [ ] Odluka A (tip prstenja) → pipeline za glave: proceduralni setovi i/ili GLB komponente + socket
- [ ] Diamond materijal (transmission + ior + matcap fire); InstancedMesh za pavé
- [ ] Gravura: canvas → height → normal (+ displacement), inside/outside, font/dubina
- [ ] Draco/KTX2 pipeline, asseti na CDN

**Acceptance:** glava se učita i pozicionira na socket pri svakoj širini shank-a; dijamant izgleda "premium" na mobilnom; gravura čita kao urezana pod svetlom; po modelu < 2 MB, load < 3 s (mobilni).

## Faza 4 — UI shell
- [ ] Framework (odluka B) + state store
- [ ] Paneli za 7 grupa, disabled stanje za `available=0` + auto-fallback
- [ ] **Live cena** (jedno polje) iz formule + masa iz shank volumena
- [ ] Deep-link: konfiguracija ↔ URL (query/hash), restore na load
- [ ] Skeleton/loader (brend shimmer), mikro-animacije, mobilni layout
- [ ] Premium feel checklist iz `3d.md` — sve stavke

**Acceptance:** cela premium checklist prođe; deljenje URL-a vraća identičnu konfiguraciju; nema layout shift-a; Lighthouse perf ≥ 90 na stranici konfiguratora.

## Faza 5 — Submit / email
- [ ] Inquiry forma (ime, email, telefon, veličina, poruka, GDPR čekboks)
- [ ] `POST /wp-json/zs/v1/inquiry`: server ponovo izračuna cenu → client-side capture slika → email zlataru (+ opc. kupcu) → snimi `zs_inquiry` CPT
- [ ] Spam: honeypot + rate limit (+ opc. hCaptcha)

**Acceptance:** submit šalje email sa slikom + specifikacijom + cenom + deep-link-om; zapis vidljiv u adminu; cena u emailu = serverska, ne klijentska.

## Faza 6 — ERPNext
- [ ] Frappe REST klijent (API key+secret), idempotentan
- [ ] Mapiranje `erp_id` ↔ `wp_zs_options`; sync SAMO cena/stanje/SKU
- [ ] [Sync now] + WP-Cron (Action Scheduler); conflict policy; log
- [ ] Opc. webhook endpoint za inbound izmene

**Acceptance:** "Sync now" ažurira cene/stanje bez diranja 3D/prezentacionih polja; ponovni sync ne pravi duplikate; nedostupan artikal → opcija disabled u konfiguratoru.

## Faza 7 — Hardening
- [ ] Perf pass na realnim uređajima (srednji Android, stariji iPhone)
- [ ] Visual regression (Playwright screenshot na ključnim kombinacijama)
- [ ] Golden-value testovi na pricing funkciji
- [ ] A11y: tastatura, ARIA, kontrast; `prefers-reduced-motion`
- [ ] Analitika (Plausible/Matomo + eventi: izbori, drop-off, broj upita)
- [ ] SEO: server-rendered sadržaj + Product JSON-LD na stranici

**Acceptance:** budžeti iz `architecture.md` ispunjeni i izmereni; nula konzolnih grešaka; a11y audit čist.

## Tehnički dug / v2 (posle v1)

Detaljna analiza konkurencije: `docs/reference/competitors.md` (Breuning + Fischer, oba na
Confmetrix engine-u).

- **DIJAMANTI** — v1 = jedan/više flush okruglih kamenova, sada **izbirljivo** (3 veličine
  Ø1.0/1.5/2.0, `available=1`), **fasetiran brilijant** flush na SPOLJNU površinu, ograničen
  na debljinu trake (decisions #46/#47). Količina 1–5 oko obima + pozicioniranje Levo/Centar/
  Desno/Slobodno PREKO ŠIRINE trake (decisions #35/#39).
  UI već nudi grupisan izbor "tipa postavke" (Obrub aktivan; Kanal delimično aktivan;
  Napeta postavka/Oko/Šapice vizuelno zamućeni "Uskoro") i Brus (samo Brilijant aktivan) —
  **ali samo Obrub/Kanal stvarno menjaju 3D** (flush u ravnu podlogu, bez krunica/šapica,
  odluka #22). Pravi v2 posao je 3D geometrija za:
  - **tip rešetke/kruništa**: kanal (+ poprečno / bočno l-r / oko celog prstena), bezel/zarge,
    tension (spannring), kandže (chaton 4/6-prong), bočne rešetke — sve već imenovano u UI-ju
    kao zamućene opcije, čeka geometriju
  - **red / pavé**: preset "trećina / pola / ceo prsten" (izračunat broj po veličini);
    `InstancedMesh` za veće količine; opcija "sa obe strane"
  - **free placement**: 2D razvijena mapa trake + drag tačke (X/Y mm) + ~17 gotovih šablona
  - **cut**: princess / baguette / ovalni / smaragd (UI dropdown već postoji, disabled);
    **kvalitet**: G/SI…G/IF + fancy boje; lab vs natural; **više grupa kamenova po prstenu**
  - skriveni kamen u unutrašnjosti trake ("diamant im ringinnern")
- ~~**Profili** — live SVG presek~~ **✅ 2026-09-06** + ~~proširiti biblioteku (v1 imao 4)~~
  **✅ 2026-09-08: 14 profila u 4 grupe** kroz jedan parametarski generator
  (`paramProfileOutline` — deljen 2D crtež + 3D lathe, decisions #44). Ostaje: fino
  usaglašavanje oblika/imena sa klijentovim katalogom; konkurencija ima ~20.
- **Materijal** — v1 = 3 zlata × 3 finiša (klijentovi V-Ray fajlovi, boje "izoštrene"
  2026-09-06 — decisions.md #28). ~~Dvobojni/trobojni uzorak — čist scaffold, ne utiče na
  3D~~ **✅ prave razmere-po-širini urađene 2026-09-07** (1:1, 1:2, 2:1, 3:1, 4:1, i
  1:1:1/1:2:1/2:1:1 — shader-based `aBandY`/`colorZonesFor()`, decisions.md #42). I dalje
  scaffold-only: **talas / dijagonalno / dijagonalno-ogledalo / segment / osovinski** (trebaju
  ugaonu, ne samo širinsku, koordinatu — v2), i **Inlay / Farbwellen** (Breuning ima 6 šema,
  mi 4). ~~finoća kao izbor (585/750)~~ **✅ 2026-09-08** (decisions #45 — menja `density` →
  masu + produbljuje boju; cene po gramu za 18k još nisu unete). v2: više finiša (12–16).
- **Žljebovi / dezen** (Grooves/Fugen) — U/V/uglasti kanal, millgriff, carbon traka,
  obojeni (emajl) umetak sa pozicijom/širinom/bojom; stepenici na ivici. **UI/state korak
  dodat 2026-09-06** (5 oblika, lista dodatih žlebova sa punim podešavanjima — decisions.md
  #33). ~~Nema 3D efekta~~ **✅ vidljivo na render-u od 2026-09-07** (decisions.md #40) +
  ~~pozicija po širini~~ **✅ 2026-09-08** (`m.position.y = grv.position`, decisions #46) +
  ~~korak-UI~~ **✅ preuređen po Breuning „Fugen/Stufen" 2026-09-09** (decisions #47) —
  ALI i dalje kao aplicirani greben, NE prava karvana šara u siluetu trake, i uvek se
  "omotava" oko celog obima (samo orijentacija:'vertical' je geometrijski tačna). Pravo
  urezivanje ostaje v2: modifikovati `profilePoints()` po obliku — CSG/displacement,
  analogno gravuri (odluka #8). Sub-tabovi „Razdvajajući žlebovi"/„Slojevi" i dalje
  placeholderi.
- ~~**Veličina prstena**: korak 0.5, checkbox "optimalni odnos širina/debljina"~~ **✅ urađeno
  2026-09-06** (Dimenzije korak — decisions.md #26/#29). Ostaje: alternativni sistemi
  veličina (US/UK/Swiss).
- ~~**Cena po prstenu** pored "za par"~~ **✅ 2026-09-08** (`.zs-price-perring`, decisions #45).
- **Gravura** — ~~vidljivo u renderu~~ **✅ aproks. 2026-09-08/09** + `maxLen` 20→30. Ostaje:
  pravo urezivanje sa dubinom (canvas→height/normal, Faza 3), izbor fonta, red simbola
  (srca/beskonačno…), faksimil/otisak prsta, diamantgravur, ćirilica.
- **Undo / Reset** dugmad; **Sačuvaj/Podeli/PDF/Deep-link** konfiguracije (Faza 5) —
  „Sačuvaj"/„Podeli" dugmad postoje u topbaru ali još nemaju handler.
- ~~**"Primeni na oba prstena"** po sekciji~~ **✅ 2026-09-08** (`copySection()`, decisions #45).
