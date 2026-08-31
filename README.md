# zs-configurator

Premium 3D konfigurator prstenja za Zlataru Stanimirović — samostalan WordPress plugin.

- Real-time WebGL (three.js), bez pre-renderovanih slika
- 7 grupa opcija: Model, Materijal, Profil, Širina, Završna obrada, Dijamanti, Gravura
- Par prstenova ("Njena burma" / "Njegova burma"), cena za par, valuta RSD
- Mount preko shortcode-a `[zs_configurator model="slug"]` (bez Gutenberg-a)
- Lagan: frontend asseti se učitavaju samo na stranici sa konfiguratorom
- Podaci: lagan admin (2 taba — ERPNext, Opcije) → keširani REST JSON → frontend
- ERPNext sync (cena / stanje / SKU) dolazi kasnije, read-only

## Dokumentacija

| Fajl | Sadržaj |
|---|---|
| `CLAUDE.md` | golden rules, struktura, build |
| `docs/architecture.md` | sistem, tok podataka, stack, performance budžet |
| `docs/design-system.md` | paleta, tipografija (Fraunces + Inter), ličnost brenda, komponente, spacing/grid |
| `docs/data-model.md` | 7 grupa, tabela `wp_zs_options`, stock, REST payload, cena |
| `docs/3d.md` | rendering, proceduralni shank, glave, materijali, gravura, asset budžet, premium checklist |
| `docs/decisions.md` | sve odluke + razlozi + otvorena pitanja |
| `docs/roadmap.md` | faze isporuke sa acceptance kriterijumima |

## Status

Faza 0 (temelji). Kod još nije napisan — vidi `docs/roadmap.md`.

## Razvoj

```
cd app && npm install && npm run dev     # frontend dev server
cd app && npm run build                  # → app/dist/, PHP ga enqueue-uje
```
