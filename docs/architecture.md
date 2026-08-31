# Arhitektura

## Pregled

```
┌─────────────────────────── WordPress (klijentov sajt, bilo koja tema) ──────────────────────────┐
│                                                                                                 │
│  wp-content/plugins/zs-configurator/                                                             │
│                                                                                                 │
│   ┌── Admin (PHP) ──────────────┐     ┌── Data layer (PHP) ──────────────┐                        │
│   │ Tab 1: ERPNext              │     │ wp_zs_options (custom tabela)     │                        │
│   │   API URL / key / secret    │     │ kompajler → jedan JSON payload   │                        │
│   │   [Sync now]  (stub)        │────▶│ keš: transient + ETag            │                        │
│   │ Tab 2: Opcije               │     └──────────────┬───────────────────┘                        │
│   │   CRUD nad 8 grupa opcija   │                    │                                            │
│   │   available / stock toggle  │                    ▼                                            │
│   └────────────────────────────┘     ┌── REST API  /wp-json/zs/v1/ ─────┐                         │
│                                      │  GET  /config?model=slug         │                         │
│         (kasnije) ERPNext ───sync──▶ │  POST /inquiry   (faza 5)        │                         │
│         cena / stanje / SKU          └──────────────┬───────────────────┘                         │
│                                                     │ jedan poziv, keširano                       │
│  Stranica sa shortcode-om [zs_configurator]         ▼                                             │
│   ┌── Frontend app (app/dist, Vite build) ─────────────────────────────────┐                      │
│   │  UI shell (Svelte/Solid/React)   ◀──state store──▶   three.js scena    │                      │
│   │   paneli opcija, LIVE cena, loader        renderer (frameloop=demand)  │                      │
│   │                                          shank (proceduralno)          │                      │
│   │                                          glave / dijamanti (GLB, CDN)  │                      │
│   │                                          materijali (runtime PBR)      │                      │
│   │                                          gravura (canvas→normal map)   │                      │
│   └──────────────────────────────────────────────────────────────────────┘                       │
└─────────────────────────────────────────────────────────────────────────────────────────────────┘
         3D asseti (GLB Draco + KTX2 + HDRI)  ──  CDN (Bunny / R2 / S3), NE u plugin zip-u
```

## Komponente

| Komponenta | Tehnologija | Odgovornost |
|---|---|---|
| Plugin bootstrap | PHP, plain WP API | konstante, lagan autoload, lenja registracija hookova |
| Admin | PHP + mali vanilla/Preact widget | 2 taba: ERPNext kredencijali + Sync; CRUD opcija + stock |
| Data layer | PHP + custom tabela `wp_zs_options` | čuvanje opcija, pravila kompatibilnosti, kompajliranje u JSON |
| REST API | `register_rest_route` | `GET /config` (jedan payload, keširan), `POST /inquiry` (faza 5) |
| Shortcode | PHP | ispiše `<div id="zs-config-root" data-model>` + **conditional enqueue** |
| Frontend app | Vite build (Svelte/Solid/React — TBD) | UI, state, cena, 3D scena |
| 3D render | three.js (imperativni), WebGL2 | scena, svetlo, geometrija, materijali, gravura |
| ERP sync | PHP, Frappe REST + webhooks | read-only: cena / stanje / SKU → `wp_zs_options` (faza 6) |
| 3D asseti | GLB (Draco) + KTX2 + HDRI | hostovano na CDN-u |

## Tok podataka

1. Klijent u adminu (Tab 2) unosi/menja opcije i `available`/`stock`.
2. Na snimanje → invalidacija keša → kompajler pravi normalizovan JSON (razrešena pravila kompatibilnosti, cene, asset URL-ovi, `available` po opciji).
3. Stranica sa shortcode-om učita `app/dist` bundle (samo tu).
4. App pozove `GET /wp-json/zs/v1/config?model=slug` — **jedan** poziv, keširan (ETag → 304).
5. Korisnik bira opcije → state store → 3D scena reaguje (pretplata), cena se računa i prikazuje **live** kao jedno polje.
6. (Faza 5) Submit → `POST /inquiry` → server **ponovo izračuna cenu** → generiše sliku → email zlataru → snimi `configuration_inquiry` CPT.
7. (Faza 6) ERPNext sync periodično/na dugme upisuje cenu/stanje/SKU u `wp_zs_options`; frontend to ne primećuje osim što nedostupne opcije postanu disabled.

## Performance budžet (hard)

| Metrika | Cilj |
|---|---|
| JS/CSS na stranicama BEZ konfiguratora | **0 bajtova** |
| App shell (bez three) | < 200 KB gz |
| three.js | ~150 KB gz, lazy/split; post-processing zaseban chunk |
| `GET /config` payload | < 50 KB gz, keširano (transient + ETag) |
| Prvi interaktivni 3D | < 2.5 s (kabl), < 3 s + < 2 MB po modelu (mobilni) |
| Interakcija | 60 fps na srednjem Android telefonu |
| Render loop | `frameloop = "demand"` — renderuj samo na promenu |
| PHP overhead na frontendu | samo shortcode callback; bez global hookova koji nešto rade |

## Van scope-a za v1
- Korpa / checkout / plaćanje (prodaja = email konfiguracije)
- AR / try-on
- Gutenberg blok
- Višejezičnost (samo srpski)
- Nalog korisnika / čuvanje konfiguracija na serveru (osim inquiry zapisa)
- Server-side high-res render (client-side capture je dovoljan za v1)
