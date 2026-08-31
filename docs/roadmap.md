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
- [ ] three.js scena: renderer (`frameloop=demand`), kamera, OrbitControls (damped)
- [ ] HDRI + PMREM + tone mapping + contact shadows
- [ ] Proceduralni shank: profil `d-comfort`, sweep, klizači width/thickness/size (live regen, debounce)
- [ ] Materijali: 5 metala (Belo/Žuto/Roze zlato 14K, Platina 950, Palladium 950) kao PBR setovi; 4 završne obrade (Polirano/Mat/Brušeno/Čekićano) kao roughness/normal override; glatki cross-fade
- [ ] PROFIL: 4 profila poprečnog preseka (Okrugli/D/Ravni/Komfort); tabovi Njena/Njegova (2 stanja)
- [ ] Fallback (nema WebGL → slika), dispose na unmount, DPR cap
- [ ] Threepipe evaluacija (1 dan) — odluka pre početka faze

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
