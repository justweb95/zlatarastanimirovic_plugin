# Odluke (ADR log)

Sve odluke donete 2026-08-31 osim gde je drugačije navedeno. Format: odluka → razlog.

## Donete

1. **Real-time WebGL, ne pre-renderovane slike.**
   7–8 nezavisnih osa → kombinatorna eksplozija; render pool postane neupravljiv. Gravura (dinamički tekst) je nemoguća sa pre-renderom. Real-time podržava beskonačno kombinacija bez ponovnog renderovanja.

2. **Jedan samostalan plugin.** Ne kod u temi, ne headless WP.
   Konfigurator ne sme zavisiti od aktivne teme. "Island" pristup: plugin drži podatke + REST + mount; ostatak sajta ostaje običan WP.

3. **Bez Gutenberg bloka.** Mount = shortcode `[zs_configurator model="slug"]` + `zs_configurator_render()` template tag.
   Klijentov zahtev. Bonus: nema block.json/editor bundle → manji build, manje koda.

4. **Lagan plugin — tvrd zahtev.**
   - Frontend asseti se enqueue-uju samo iz shortcode callback-a (nula na ostalim stranicama).
   - Admin asseti samo na plugin ekranima.
   - Bez ACF-a i drugih teških zavisnosti → sopstveni lagan admin.
   - Bez Composer autoload bloata; lenja registracija hookova.

5. **three.js imperativni** (ne react-three-fiber) za render sloj.
   Pun nadzor nad render loop-om, kompajliranjem šejdera, memory managementom. R3F reconciler je nepotreban sloj za ovaj slučaj.

6. **Proceduralna parametarska geometrija shank-a.** Bez lažnog skaliranja.
   Širina/debljina/veličina su klizači → moraju menjati pravu geometriju live i glatko. Lažno skaliranje izobliči presek iz blizine. Parametarski profil-sweep to rešava i daje volumen (→ masu → cenu) besplatno.

7. **Glave: biblioteka komponenti ili proceduralni setovi, NE model po modelu.**
   "100+ modela" = kombinacije, ne 100+ meševa. CAD po modelu samo za unikatne/vintage komade. Konkretan obim zavisi od tipa prstenja → vidi otvorena pitanja.

8. **Gravura: canvas → normal (+ blagi displacement) map, real-time.** Ne CSG.
   Standard koji premium konfiguratori koriste; izgleda urezano pod HDRI svetlom; radi glatko na mobilnom.

9. **Podaci: custom tabela `wp_zs_options` + kompajlovani keširani REST JSON (ETag).**
   Brže i lakše od CPT-a za enumerabilne opcije, bez ACF-a. Jedan REST poziv za ceo config. MODEL/jedinstvene glave mogu biti CPT ako klijentu treba bogatiji editor (nije zaključano).

10. **Stock/dostupnost: `available` flag po opciji → disabled u UI.**
    Ručno se pali/gasi u adminu sada; ERPNext ga postavlja kasnije. Prazno skladište dijamanata → oblik disabled, auto-fallback ako je bio izabran.

11. **ERPNext: read-only sync (cena / stanje / SKU), izolovan modul.**
    WP = izvor istine za sve prezentaciono/3D. ERPNext = izvor za cenu/zalihe/šifre. Admin Tab 1: API URL + key + secret + [Sync now]. **Stub za sada** (dolazi kasnije). Frontend NIKAD ne priča sa ERPNext-om direktno (bezbednost).

12. **Cena: live, jedno polje u konfiguratoru.** Računa se iz `metal × zapremina × finoća + doplate`. Server ponovo izračuna na submit (autoritativno). Spot cena metala: ručno polje / cron sada, ERPNext kasnije.

13. **Prodajni model v1: cela konfiguracija ide na email.** Bez korpe/checkout-a/plaćanja.

14. **Samo srpski.** Bez i18n infrastrukture za v1.

15. **3D asseti na CDN-u** (GLB Draco + KTX2 + HDRI). Nikad kroz PHP, nikad u plugin zip-u.

## Dizajn sistem (iz Figme, 2026-08-31) — vidi `design-system.md`

16. **Paleta zaključana.** Topla bela `#FBF9F4` pozadina (55–60%), slonovača `#F5F0E6` površine, tamnozelena `#1F3D2E` = jedina primarna/CTA boja, braon `#8B5A34` sekundarna. 75–85% neutralno; zelena/braon samo kao akcenti. Selektovano stanje = zelena, nikad samo senka.

17. **Dva fonta: Fraunces (serif) + Inter (sans).** Fraunces = display/H1–H3, cena, imena modela. Inter = sve tehničke opcije, body, labele, dugmad. Oba Google Fonts.

18. **Layout grid `220px / 1fr / 300px`**, max 1440px. Spacing skala 4/8/12/16/24/32/48/64. Radius 8–12px, border 1px `#E2DBCB`.

19. **7 koraka, ne 8**: MODEL · MATERIJAL · PROFIL · ŠIRINA · ZAVRŠNA OBRADA · DIJAMANTI · GRAVURA. PROFIL = diskretan (Okrugli/D/Ravni/Komfort), ŠIRINA = klizač (2–6 mm). "8. tačka" (veličina) otpada iz koraka — veličina se bira drugde (npr. u ŠIRINA sekciji ili pri upitu).

20. **Par prstenova sa tabovima**: "Njena burma" / "Njegova burma" = dve nezavisne konfiguracije; cena je "ZA PAR". Konfigurator mora držati 2 stanja + tab UI.

21. **Valuta: RSD.** Format `89.500 RSD` (tačka kao hiljadarski separator).

22. **Tip prstenja = glatke burme (par), v1** (odgovor na pitanje A, 2026-09-03).
    Klijent dao Rhino fajlove: `Ravna_4mm.3dm`, `Zaobljena_4mm.3dm` + iste sa utisnutim kamenom Ø1.5 mm. Nema vereničkih sa setom u v1 → **nula CAD glava**, sve proceduralno (shank + mali flush kamen).

23. **Debljina = zaseban klizač** (odgovor na pitanje D, 2026-09-03).
    ŠIRINA korak drži 3 kontrole: **Širina** 3.0–8.0 mm korak 0.5, **Debljina** od 1.0 mm korak 0.1 (max ~2.5, podesivo u adminu), **Veličina (EU)**.

24. **Masa/cena — formula klijenta** (2026-09-03):
    ```
    meanCircumference_mm = size + PI * thickness
    area_mm2             = width * thickness * fill        // fill = fill-faktor profila (Ravni 1.0, zaobljeni < 1)
    volume_cm3           = area_mm2 * meanCircumference_mm / 1000
    weight_g            = volume_cm3 * density(finoća)     // specifična težina, podesiva
    ringPrice           = base + weight_g * cenaPoGramu + finiš + dijamant + gravura
    pairPrice           = ringHer + ringHis
    ```
    `density` po materijalu u `params_json`; `cenaPoGramu` po finoći u `zs_settings` (ručno sad, ERPNext kasnije). Server ponovo računa na upit.

25. **Materijali i finiši iz klijentovih V-Ray fajlova** (`*.gvVisMat`, 2026-09-03).
    3 metala: **Žuto** `#E6C181`, **Belo** `#C3C3CD`, **Crveno** `#FFB9AA` (svi 14K). 3 finiša iz reflection glossiness: **Polirano** (gloss 1.0 → rough ~0.06), **Mat** (0.5 → ~0.42), **Grebano** (0.6 → ~0.34, anizotropna normal mapa). Platina/Palladium se dodaju u adminu ako klijent proširi ponudu.

## Otvorena pitanja (blokiraju procenu obima)

| # | Pitanje | Zašto je bitno |
|---|---|---|
| ~~A~~ | ✅ Rešeno (odluka 22): glatke burme, par, bez CAD glava. | — |
| B | **Finalni frontend framework**: Svelte / SolidJS / React / Preact? | Ne blokira arhitekturu, ali treba pre Faze 4. Lean: Svelte ili Solid (mali runtime). |
| C | **CDN provider**: Bunny / Cloudflare R2 / S3+CloudFront? | Treba pre Faze 3 (upload pipeline za asseti). |
| ~~D~~ | ✅ Rešeno (odluka 23): debljina = zaseban klizač. | — |
| E | **Dijamanti za burme**: koliko veličina flush kamena u v1 (seedovano Ø1.0 / 1.5 / 2.0 mm)? Više kamena / pavé red? | Obim proceduralnog kamenja + stock logika. |
| E2 | **`.3dm` geometrija**: da li klijent može da izveze `.obj`/`.glb` iz Rhina (mesh, ~50k), ili idemo 100% proceduralno? | Proceduralno je plan (odluka 6) i radi bez Rhina; CAD izvoz treba samo ako se traži tačna geometrija 1:1. |
| F | **Email**: primalac(ci)? kopija kupcu? slika client-side ili server-side? | Faza 5. Odloženo. |
| G | **MODEL/glave kao CPT ili tabela?** | Zavisi koliko bogat editor klijentu treba (slike, opisi). |
| H | **Tačne px veličine/weight-ovi tipografije** — izvući iz Figma Dev Mode. | Zaključati type scale u tokene. |

## Za reviziju kasnije
- Threepipe evaluacija (1 dan) pre nego što se krene sa scene bootstrap-om (Faza 2).
- Da li shank volumen računati i na serveru (duplo) ili verovati klijentu pa validirati grubo.
