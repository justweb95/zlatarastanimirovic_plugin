# zs-configurator — Claude guide

3D konfigurator prstenja za zlataru, isporučen kao **jedan samostalan WordPress plugin**.
Real-time WebGL (three.js). Uzor kvaliteta: ijewel3d.com/products/ring-configurator.

## Golden rules (ne kršiti bez eksplicitne odluke u `docs/decisions.md`)

1. **Lagan plugin.** Ovo je glavni zahtev klijenta.
   - Frontend JS/CSS se `wp_enqueue`-uje **samo** kad se renderuje shortcode `[zs_configurator]`. Nula bajtova na ostalim stranicama.
   - Admin JS/CSS samo na plugin admin ekranima (`load-{hook}` guard).
   - Bez teških PHP zavisnosti. Bez ACF-a — sopstveni lagan admin. Bez Composer autoload bloata.
   - PHP: hookovi se registruju lenjo; admin-only kod iza `is_admin()`.
2. **Premium.** Vidi `docs/3d.md` → "Premium feel checklist" i `docs/design-system.md` (banner na vrhu: re-skin na živi sajt `zlatarastanimirovic.rs` — zlatna `#D4AF37` akcije, mastilo `#262626`, **Belleza + Lato**, 2px uglovi, decisions #49; Figma paleta / Fraunces+Inter ispod = istorija). Isti brend-kit je sada i na adminu (decisions #57). 60fps, instant switch opcija, damped kontrole, HDRI studio svetlo, bez layout shift-a. Selektovano = zelena `#1F3D2E`, nikad samo senka.
3. **Real-time WebGL.** Nikad pre-render. Geometrija: shank proceduralno, glave iz komponenti/proceduralno, dijamanti instancirani. Vidi `docs/3d.md`.
4. **Bez Gutenberg-a.** Mount = shortcode `[zs_configurator model="slug"]` + `zs_configurator_render( $args )` template tag.
5. **Srpski UI.**
6. **Konfigurator nikad ne priča direktno sa ERPNext-om** — samo sa WP REST API-jem.

## Struktura

```
zs-configurator/
  zs-configurator.php      # bootstrap: konstante, autoload (lagan), hook registracija
  src/                     # PHP
    Admin/                 #   settings stranica: Tab 1 ERPNext, Tab 2 Opcije
    Rest/                  #   register_rest_route → /wp-json/zs/v1/*
    Data/                  #   custom tabela wp_zs_options, upiti, kompajler JSON payload-a
    Shortcode/             #   [zs_configurator] + conditional enqueue
    Erp/                   #   ERPNext klijent + sync (stub za sada)
  app/                     # frontend — SVOJ build (Vite), svoj package.json
    src/
      scene/               #   three.js: renderer, kamera, svetlo, shank, glave, dijamanti, gravura
      ui/                  #   panel opcija, cena, loader
      state/               #   store (izbor opcija, cena, validnost)
      api/                 #   fetch config JSON
    dist/                  # build output → PHP ga enqueue-uje
  assets/                  # male stvari (ikonice). GLB/HDRI/KTX2 idu na CDN.
  docs/
```

## Build

```
cd app && npm i && npm run build     # → app/dist/
cd app && npm run dev                 # dev server; WP stranica proxy-uje asset
```

Plugin verzija u `zs-configurator.php` header-u = cache-bust za enqueue.

## Testiranje / QA

- Frontend (bez `app/` build-a još): vanilla `assets/js/configurator.js` +
  `assets/js/scene.module.js`. Posle izmena: `node -c` na oba, pa vizuelna
  provera u browseru.
- **Headless browser radi u ovom okruženju** (decisions.md #48): Playwright
  Chromium je preinstaliran (`~/.cache/ms-playwright/`), renderuje WebGL
  (SwiftShader — three.js transmisija/refrakcija se NE vide, ali dijamant v2
  ima sopstveni ray-trace shader i izgleda isto kao na GPU-u, decisions #73) i ima
  pristup internetu → koristi ga za poređenje sa `konfigurator.breuning.de` i za
  proveru našeg UI-ja. `playwright-core` vozi već prisutni binarni fajl.
- `window.__zscApp` je izložen u `mount()` — `__zscApp.cur()`,
  `.sceneStateFor('her'|'his')`, `.scene` (`setSolo`, `reset`, `zoom`…).
- Posle izmena `Seeder.php`: `TRUNCATE wp_zs_options` + `Seeder::run()` +
  `Compiler::flush_all()` (`wp eval … --allow-root`).

## Docs

- `docs/architecture.md` — sistem, tok podataka, stack, performance budžet, scope
- `docs/design-system.md` — brend-kit (re-skin banner: zlatna/mastilo, Belleza + Lato; Figma paleta / Fraunces+Inter ispod = istorija), ličnost brenda, komponente, spacing/grid; `docs/reference/` screenshotovi iz Figme
- `docs/data-model.md` — 7 grupa opcija, polja, stock, REST payload, cena
- `docs/3d.md` — rendering, proceduralni shank, glave, materijali, gravura, asset budžet, premium checklist
- `docs/decisions.md` — sve odluke + razlozi + otvorena pitanja
- `docs/roadmap.md` — faze isporuke sa acceptance kriterijumima

## Otvorena pitanja koja blokiraju (detalji u decisions.md)
- Tip prstenja (glatke burme / verenički sa setom / unikati) → određuje da li i koliko CAD-a
- Finalni izbor frontend frameworka (Svelte / Solid / React)
- CDN provider
