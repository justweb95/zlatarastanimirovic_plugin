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

## Otvorena pitanja (blokiraju procenu obima)

| # | Pitanje | Zašto je bitno |
|---|---|---|
| A | **Tip prstenja**: glatke burme / verenički sa setom / unikati? | Mockup pokazuje burme (par, Njena/Njegova) → verovatno **malo/nimalo CAD-a**. Potvrditi da nema vereničkih sa setom u v1. |
| B | **Finalni frontend framework**: Svelte / SolidJS / React / Preact? | Ne blokira arhitekturu, ali treba pre Faze 4. Lean: Svelte ili Solid (mali runtime). |
| C | **CDN provider**: Bunny / Cloudflare R2 / S3+CloudFront? | Treba pre Faze 3 (upload pipeline za asseti). |
| D | **Debljina prstena** = zaseban parametar ili implicirana profilom? Gde se bira **veličina** (obim prsta)? | Tipografski list pominje "širinu i debljinu"; mockup nema eksplicitnu debljinu ni veličinu. |
| E | **Broj oblika dijamanata u v1** + kako izgleda DIJAMANTI korak za burme (utisnut kamen? koliko?). | Obim GLB biblioteke kamenja. |
| F | **Email**: primalac(ci)? kopija kupcu? slika client-side ili server-side? | Faza 5. Odloženo. |
| G | **MODEL/glave kao CPT ili tabela?** | Zavisi koliko bogat editor klijentu treba (slike, opisi). |
| H | **Tačne px veličine/weight-ovi tipografije** — izvući iz Figma Dev Mode. | Zaključati type scale u tokene. |

## Za reviziju kasnije
- Threepipe evaluacija (1 dan) pre nego što se krene sa scene bootstrap-om (Faza 2).
- Da li shank volumen računati i na serveru (duplo) ili verovati klijentu pa validirati grubo.
