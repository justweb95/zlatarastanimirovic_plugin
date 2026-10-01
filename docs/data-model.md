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

> **Ažurirano 2026-09-14** (decisions #59): admin "Opcije" forma više ne
> pokazuje `price_json`/`params_json`/`compat_json` kao sirov JSON textarea —
> zbunjivalo je klijenta. `price_json` za flat tip (najčešći slučaj — sve
> grupe osim `material`/`width`) ima normalno "Cena (RSD)" broj polje;
> napredni tipovi (`per_gram`, `in_mass`) i dalje postoje nepromenjeni u
> bazi, samo bez UI za njih. `params_json`/`compat_json` se i dalje mogu
> menjati, samo ne kroz ovu formu — preko `?zscdebug=1` panela ili direktno
> u `Seeder.php`. Šema (kolone gore) je nepromenjena, menjano je samo kako
> se admin UI odnosi prema njima.

Globalna podešavanja → jedan `wp_option` `zs_settings` (JSON): valuta, email primaoci, HDRI URL, CDN baza, i **cene** (decisions #77):
- `spot_prices` — RSD/g po ključu (`au_14k`, `au_18k`, `au_22k`, `au_24k`, `pt_950`, `pd_950`). Ime „spot“ je istorijsko: vrednosti **unosi admin ručno**, nema online cene.
- `finoce` — finoće u konfiguratoru: `{id:'585', label, sub:'14K', price_key:'au_14k', enabled, deepen, density:{zuto,belo,crveno}}`. Uređuje se u adminu (Podešavanja → „Cena zlata po gramu“), u payload ide `pricing.finoce` (samo aktivne).

`zs_data_version` (wp_option) — verzija jednokratne nadogradnje postojećih redova (`Seeder::upgrade_data`, trenutno 2).

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
> `params.group` (Osnovni / Zaobljeni / Ravni / ~~Šiljati profili~~) + parametarske
> knobove za novih 10 profila. **Finoća** (585/750) je klijentski izbor u
> `configurator.js` (`FINOCA` tabela — `density` po metalu + `deepen` za boju),
> NE zaseban `wp_zs_options` red za sada; menja masu → cenu.
>
> **Ažurirano 2026-09-14** (decisions #60): grupa "Šiljati profili" (Nožasti,
> Šiljati oval) izbačena iz ponude — `enabled=0`, redovi ostaju u bazi.

## Cena — formula (implementirano 2026-10-01, decisions #77)

Po prstenu, u `configurator.js` (`ringVolume` → `ringWeight` → `_ringPrice`):

```
volume_mm3 = zapremina mreže trake koju scena crta (scene.ringVolume:
             profil (Wama pravila) × širina × debljina × veličina, žlebovi usečeni)
mass_g     = volume_mm3 / 1000 × density(metal, finoća)         ← CMS (zs_settings.finoce)
raw        = mass_g × pricePerGram(finoća)                       ← CMS (zs_settings.spot_prices), bez množenja čistoćom
           + finish.amount + diamond.amount × kom + engraving.amount
cenaPrstena = Math.ceil(raw)                                     ← uvek naviše, ceo RSD
cenaPara    = ceil(rawA) + ceil(rawB)                            ← NE ceil(rawA + rawB)
```

- Masa se nikad ne zaokružuje pre cene; prikaz mase 2 decimale (samo prikaz).
- Prikaz: `Intl.NumberFormat('sr-RS')`, „Ukupno“ + „Cena prvog prstena“ (Njena) / „Cena drugog prstena“ (Njegova).
- Cena 0 ili gustina 0 → „Cena na upit“.
- Poznata pojednostavljenja: Dve/Tri boje koriste gustinu glavnog metala; ležište kamena (shader rupa) nije oduzeto od zapremine (< 1 %); `model.basePrice` se ne koristi (svi su 0).
- **Još nije urađeno:** autoritativni obračun na serveru pri upitu (Faza 5) — mora da ponovi istu zapreminu (presek po Wama pravilima × Pappus ili ista mreža).

## Keširanje / verzionisanje

- Kompajlovani payload u `transient` (`zs_config_{model}_{hash}`), TTL 12h, obrisati na svaku izmenu opcija/podešavanja.
- REST odgovor nosi `ETag: "<version>"`; klijent šalje `If-None-Match` → `304`.
- Frontend keš u `sessionStorage` po verziji.
