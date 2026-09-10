# Model podataka

## 7 grupa opcija (iz mockup-a)

Koraci: `MODEL · MATERIJAL · PROFIL · ŠIRINA · ZAVRŠNA OBRADA · DIJAMANTI · GRAVURA`.
Konfigurator drži **dve nezavisne konfiguracije** — "Njena burma" / "Njegova burma" (tabovi), cena je "ZA PAR".

| # | Grupa | Tip u UI | Uticaj na cenu | Uticaj na 3D | Stock? |
|---|---|---|---|---|---|
| 1 | **MODEL** | kartice (leva lista) | bazna cena modela | učitava base geometriju / proceduralni preset | da (model može biti povučen) |
| 2 | **MATERIJAL** | swatch dugmad | `masa × spot_cena × faktor_finoće` | runtime PBR set. Opcije: Belo zlato 14K, Žuto zlato 14K, Roze zlato 14K, Platina 950, Palladium 950 | opciono |
| 3 | **PROFIL** | chip-ovi (diskretno) | fiksna doplata (opc.) | bira profil poprečnog preseka proceduralnog shank-a. Opcije: Okrugli, D-profil, Ravni, Komfort | ne |
| 4 | **ŠIRINA** | **klizač 2–6 mm** | ulazi u masu → cena | skalira profil duž ose prstena | ne |
| 5 | **ZAVRŠNA OBRADA** | dugmad | fiksna doplata po obradi | roughness/normal varijanta. Opcije: Polirano, Mat, Brušeno, Čekićano | ne |
| 6 | **DIJAMANTI** | oblik + karat + kvalitet | `cena(oblik, karat, kvalitet) × broj` | utisnut kamen na bendu (burme) / gem slotovi; MeshPhysicalMaterial transmission | **da — glavni slučaj**: 0 na stanju → opcija disabled |
| 7 | **GRAVURA** | tekst + font + strana | fiksna doplata (ili 0) | canvas → height → normal (+ blagi displacement) na segmentu shank-a | ne |

**Debljina** i **veličina (obim prsta)**: nisu zaseban korak u mockup-u. Debljina je verovatno implicirana profilom; veličina se bira u ŠIRINA sekciji ili pri upitu. → otvoreno pitanje D u `decisions.md`.

Boje/tipografija/komponente za sve ovo: vidi `design-system.md`.

## Skladištenje

**Custom tabela `wp_zs_options`** (lakše i brže od CPT-a za enumerabilne opcije; bez ACF zavisnosti):

```
id            BIGINT PK
group_key     VARCHAR(32)   -- 'model' | 'material' | 'finish' | 'diamond' | 'engraving' | ...
slug          VARCHAR(64)
label_sr      VARCHAR(191)
sort          INT
enabled       TINYINT(1)    -- klijent ručno pali/gasi
available     TINYINT(1)    -- ima na stanju (ručno sad, ERPNext kasnije)
stock_qty     INT NULL      -- opciono, iz ERPNext-a
price_json    JSON          -- doprinos ceni: {type:'flat'|'per_gram'|'matrix', ...}
params_json   JSON          -- 3D/prezentacija: PBR set, GLB URL, profil parametri, opseg klizača, roughness...
compat_json   JSON          -- allow-liste: {materials:[...], models:[...]} (prazno = sve dozvoljeno)
erp_id        VARCHAR(64) NULL   -- external ID za rekonsilijaciju sa ERPNext-om
updated_at    DATETIME
```

Globalna podešavanja (spot cena metala po finoći, email primaoci, HDRI URL, CDN baza) → jedan `wp_option` `zs_settings` (JSON).

MODEL i (ako ih bude) jedinstvene GLAVE mogu biti CPT `zs_ring_model` / `zs_head` ako klijentu treba bogatiji editor (slike, opis) — odluka u `decisions.md`. Ostatak ostaje u tabeli.

## Dostupnost / stock ponašanje u konfiguratoru

- `enabled = 0` → opcija se **ne prikazuje**.
- `enabled = 1, available = 0` → prikazana ali **disabled**: zasivljena, ne može se kliknuti, tooltip "Trenutno nedostupno".
- Ako je trenutno izabrana opcija postala `available = 0` (npr. posle ERPNext sync-a) → konfigurator automatski prebaci na najbližu dostupnu i obavesti korisnika.
- Za DIJAMANTE: filtriranje po oblik/karat/kvalitet kombinaciji — ako nijedna kombinacija tog oblika nije na stanju, ceo oblik je disabled.

## Pravila kompatibilnosti

- Data-driven, u `compat_json` po opciji (allow-liste).
- Razrešavaju se **server-side** u kompajleru → payload nosi finalno `available`/`compatible` po opciji za dati model.
- UI samo poštuje flagove; nema hardkodovane logike.

## REST payload (`GET /wp-json/zs/v1/config?model=slug`)

```jsonc
{
  "version": "2026-08-31T23:00:00Z",     // ETag izvor
  "currency": "RSD",
  "model": {
    "slug": "aurora-solitaire",
    "label": "Aurora Solitaire",
    "basePrice": 48000,
    "head": { "type": "gltf", "url": "https://cdn.../heads/aurora.glb", "socket": "shank_top" },
    "shank": {
      "profile": "d-comfort",
      "width":     { "min": 1.6, "max": 3.4, "step": 0.1, "default": 2.0, "unit": "mm" },
      "thickness": { "min": 1.2, "max": 2.2, "step": 0.1, "default": 1.6, "unit": "mm" },
      "size":      { "min": 44,  "max": 66,  "step": 1,   "default": 54,  "unit": "EU" }
    }
  },
  "groups": {
    "material": [
      { "slug": "yg18", "label": "Žuto zlato 18k", "available": true,
        "pbr": { "color": "#E6C063", "metalness": 1, "roughness": 0.18 },
        "price": { "type": "per_gram", "pricePerGram": 7600, "purity": 0.75, "density": 15.6 } }
    ],
    "finish":   [ { "slug": "polished", "label": "Polirano", "available": true,
                    "pbr": { "roughness": 0.05 }, "price": { "type": "flat", "amount": 0 } } ],
    "diamond":  [ { "slug": "round-1_5", "label": "Ø 1,5 mm", "shape": "round",
                    "mm": 1.5, "quality": "H/SI", "available": true,
                    "price": { "type": "flat", "amount": 12000 } } ],
    "engraving": { "maxLen": 30, "fonts": ["serif","script"], "sides": ["inside","outside"],
                   "price": { "type": "flat", "amount": 3000 } }
  }
}
```

> **Ažurirano 2026-09-08/09** (decisions #44–47): `engraving.maxLen` 20→30.
> Diamond redovi su `available: true` (bili stock-gate off). Profil grupa ima
> `params.group` (Osnovni / Zaobljeni / Ravni / Šiljati profili) + parametarske
> knobove za novih 10 profila. **Finoća** (585/750) je klijentski izbor u
> `configurator.js` (`FINOCA` tabela — `density` po metalu + `deepen` za boju),
> NE zaseban `wp_zs_options` red za sada; menja masu → cenu.

## Cena — formula (skica)

```
masa_g   = zapremina_shank(width, thickness, size) * density(material) * purity(material)
           + masa_glave(model, material)
cena =  model.basePrice
      + masa_g * material.pricePerGram
      + finish.amount
      + Σ diamond.amount * count
      + engraving.amount
```

- Zapremina shank-a: proceduralna geometrija je već u three.js → izračunaj mesh volumen (signed tetrahedra), pošalji nazad ili duplo računaj i na serveru.
- `masa_glave` po materijalu: izvezi iz CAD-a kao grame, čuvaj u `params_json` glave.
- Prikaz: **live, jedno polje** u konfiguratoru.
- Autoritativno: `POST /inquiry` ponovo izračuna na serveru (ne veruj klijentu).
- Spot cena metala: `zs_settings` polje + ručni "osveži" ili cron na besplatni gold-price API; kasnije iz ERPNext-a.

## Keširanje / verzionisanje

- Kompajlovani payload u `transient` (`zs_config_{model}_{hash}`), TTL 12h, obrisati na svaku izmenu opcija/podešavanja.
- REST odgovor nosi `ETag: "<version>"`; klijent šalje `If-None-Match` → `304`.
- Frontend keš u `sessionStorage` po verziji.
