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

## Odluke — 2026-09-06 (klijent, drugi krug UI/UX — 15 stavki u jednoj sesiji)

26. **Koraci restrukturirani, "Model" korak ukinut.** Novi redosled: **Profil ·
    Dimenzije · Materijal · Žlebovi · Dijamanti · Gravura** (bilo: Model ·
    Materijal · Profil · Širina · Završna obrada · Dijamanti · Gravura) — prati
    redosled konkurenta (Confmetrix, `docs/reference/competitors.md`). PROFIL
    (4 postojeće cross-section forme: ravni/zaobljeni/d-profil/okrugli) je sada
    ulazna tačka, prikazan kao kartice sa slikom preseka + tekstom (ne chip-ovi).
    "Model" (ravna/zaobljena/ravna-kamen/zaobljena-kamen — `wp_zs_options`
    `group_key='model'`) više nije korisnički izbor: sve 4 vrste imaju
    `basePrice=0` i isti `fill` koji već nosi `profile` grupa, tako da ništa nije
    izgubljeno — `model` red se i dalje interno razrešava (prvi `model` čiji
    `params.profile` odgovara izabranom profilu) samo za bazne/fallback
    vrednosti, korisnik ga nikad ne bira. Leva kolona sa listom modela je
    obrisana u celosti — 3D viewport sada ide od levе ivice do desnog panela.
    "Završna obrada" (finish grupa) uklopljena u MATERIJAL korak (dropdown/chip
    "Površina" pored swatch-eva metala) — nije poseban korak. Svaka akordeon
    sekcija ima "Sledeće" dugme (napreduje na sledeći korak); gornja navigacija
    po brojevima sad ispravno prati aktivan korak (stari kod je uvek isticao
    "Model", bug — nikad nije ažurirao aktivni korak).
27. **Beli refresh palete.** `--zs-bg` `#FBF9F4`→`#FFFFFF`, `--zs-surface`
    `#F5F0E6`→`#F7F7F5`, `--zs-surface-2`/`--zs-border` analogno neutralizovani
    (klijent: oba starija tona "žućkasta", ne sviđaju se). Zelena/braon/gold
    akcenti nepromenjeni. `docs/design-system.md` ažuriran, stara paleta ostaje
    zapisana kao istorijski kontekst.
28. **3 boje zlata "izoštrene".** Filter-boje iz V-Ray fajlova (odluka #25) bile
    su vizuelno zamućene/blede; klijent tražio bogatije/oštrije tonove iste 3
    nijanse: Žuto `#E6C181`→`#D9A945`, Belo `#C3C3CD`→`#D6D9DE`, Crveno
    `#FFB9AA`→`#E8A28C` (`src/Data/Seeder.php`).
29. **Debljina klizač step 0.1→0.5mm**, default 1.4→1.5mm (raspon 1.0–2.5
    nepromenjen). I širina (već 0.5) i veličina (već 0.5 u Seeder-u, ali
    frontend UI je greškom hardkodovao step=1 za veličinu — ispravljeno) sad
    dosledno koriste isti "čist broj" korak. Zaseban bug fix uz to: tick-labele
    ispod klizača su se računale kao (max-min)/4 bez obzira na pravi `step`, pa
    su ispadale neporavnate vrednosti (4.3/5.5/6.8 na širini 3–8 step 0.5) —
    nova `niceTicks()` u `configurator.js` uvek zaokružuje na najbliži umnožak
    pravog koraka.
30. **Her/his default veličine namerno različite.** `defaultState(ringKey)`
    sada oduzima/dodaje malu deltu (širina ±1mm, debljina ±0.5mm, veličina
    ±6 EU) od podrazumevanih vrednosti groupe, tako da početni render (pre bilo
    kakvog diranja klizača) UVEK pokazuje "njenu" burmu manju/tanju od
    "njegove" — ranije su oba prstena krenula identična.
31. **Render viewport fiksne visine** (`--zs-view-h: 560px`, `420px` na uskim
    ekranima) — ranije je `.zs-view` koristio `flex:1` unutar `.zs-shell`
    (flex kolona `min-height:100vh`), pa je visina zavisila od visine prozora i
    (posredno, kroz CSS grid stretch) od dužine sadržaja desnog panela. Sad
    `align-items:start` na `.zs-shell` + fiksna visina na `.zs-view` — render
    se nikad ne menja veličinom bez obzira na prozor ili koliko je panel visok.
32. **Logo u header-u.** Klijentova 2 fajla (`zlatara-stanimirovic-logo.png` =
    pun wordmark, `zlatara-stanimirov-logo-small.png` = samo dijamantski znak)
    kopirana u `assets/img/logo-full.png` / `logo-mark.png`; boot JSON nosi
    `assetsUrl` (novo polje) da frontend JS može da sastavi URL bez hardkodovane
    PHP konstante. Pun wordmark je podrazumevani brend u topbar-u; mark-only
    verzija se prikazuje na uskim ekranima (`max-width:640px`) gde bi pun
    wordmark bio pretesan — CSS media-query swap, ne JS.
33. **Grooves (Žlebovi) — nov korak, UI/state samo, bez 3D geometrije još.**
    Petи oblika (V-žleb 90°/U-žleb/Ugaoni/Perlaž/Karbon) + lista dodatih
    žlebova (oblik, površina, širina, dubina, orijentacija, pozicija, brisanje)
    — čisto frontend state (`s.grooves` niz), ništa ne diramo u
    `scene.module.js` geometriji. **Tehnički dug** (roadmap.md): stvarno urezivanje
    žlebova u proceduralni shank je poseban 3D zadatak za kasnije. Dva od tri
    pod-taba (Razdvajajući žlebovi / Slojevi) su placeholder-i ("stižu uskoro").
34. **Materijal — pattern koraci (Jedna/Dve/Tri boje/Slobodno) su UI scaffold,
    ne utiču na 3D još.** Klijent eksplicitno rekao "za sada" — birajući
    Dve/Tri boje samo čuva izbor u state-u i prikazuje napomenu da 3D i dalje
    koristi jednu boju; "Slobodno" je vizuelno zamućen/disabled ("Uskoro").
    Sub-pattern popover (1:1, 1:2, wave, dijagonalno, itd.) isto samo UI.
35. **Dijamanti prošireni**: tip postavke (grupisano Obrub/Kanal/Napeta
    postavka/Oko/Šapice — samo Obrub + 3 Kanal varijante aktivne, ostalo
    vizuelno zamućeno "Uskoro", u duhu odluke #22 — nema krunica/šapica u v1),
    Brus (samo Brilijant aktivan), Kvalitet (fiksno, informativno), Količina
    (1–5) i Pozicioniranje (Levo/Centar/Desno/Slobodno). `scene.module.js`
    `buildStoneFor()` sada prima niz pozicija (`state.stone.positions`) umesto
    jedne — N kamenova deljene geometrije, ravnomerno raspoređeni oko bazne
    pozicije (razmak 2.4mm) — potvrđeno konzolskim logom tokom razvoja
    (pozicije `[-2.4,0,2.4]` za qty=3), a ne samo vizuelno (headless swiftshader
    render na ovoj mašini je premali/pod pogrešnim uglom da bi se 1.5mm kamen
    jasno video na ~40mm prstenu — klijent treba da potvrdi izgled u pravom
    browseru).

## Odluke — 2026-09-07 (klijent, treći krug — bugfix + Materijal/Žlebovi stvarno rade)

36. **Profil redosled: Zaobljeni prvi, Ravni poslednji** (client, ponovljeno iz
    starog model-sort zahteva, sada primenjeno direktno na `profile` grupu —
    `src/Data/Seeder.php` sort 10/20/30/40 = zaobljeni/d-profil/okrugli/ravni).
37. **Bottombar (cena/CTA) je sada `position:fixed` + `z-index:999`**, uvek
    prikovan za dno viewporta nezavisno od skrola/sadržaja iznad (klijent
    tražio "position absolute" — implementirano kao `fixed`, jer je to
    jedini CSS mehanizam koji stvarno postiže opisano ponašanje; `absolute`
    bi i dalje skrolovao sa stranicom). Visina se meri live
    (`ResizeObserver` → `--zs-bottombar-h`) i koristi kao `padding-bottom`
    na `.zs-configurator` da poslednja sekcija ne završi ispod trake.
38. **Materijal pattern popover otvara se ULEVO, ne ispod.** Panel je bio
    `overflow:hidden` (samo radi zaobljenih ivica) što je seklo popover van
    vidljivog dela — promenjeno u `overflow:visible`; popover sad `right:
    calc(100% + 10px)` (otvara se preko 3D viewporta, ne van ekrana desno).
39. **Dijamant/žleb pozicija je ŠIRINSKA osa, ne pozicija oko obima.**
    Ranije (26-09-06 sesija) je "Pozicioniranje" (Levo/Centar/Desno/Slobodno)
    pogrešno mapirano na poziciju OKO prstena (kao sat 12/3/6/9) — klijent je
    razjasnio (2026-09-07) da to zapravo znači gde PREKO ŠIRINE trake kamen
    sedi (bliže jednoj ivici ili drugoj), tačno kao referentne ikonice
    (tačka pomerena levo/desno unutar silуete trake). Ispravljeno:
    `diamondWidthPos()` (configurator.js) sada vraća mm-offset preko širine,
    dinamički ograničen na `[-(width/2-1), +(width/2-1)]` (klijent: "5mm
    traka, mora ostati 1mm od svake ivice") I dalje izbegava svaki postojeći
    žleb (`grooveForbiddenRanges` + `nudgeOutOfForbidden`, clearance 0.4mm) —
    ako je tačno mesto blokirano žlebom, dugme (Levo/Centar/Desno) se
    onemogućava sa "Blokirano" bedžom, a "Slobodno" klizač se automatski
    pomera van zabranjene zone. Isti mehanizam sada koristi i žlebova
    "Pozicija (mm)" polje (ograničeno na širinu trake minus 1mm marže minus
    sopstvenu širinu žleba). "Količina" (1-5) i dalje raspoređuje kamenove
    OKO obima (nepromenjeno, decisions.md #35) — sada NEZAVISNO od širinske
    pozicije (svi dele isti `widthPos`).
40. **Žlebovi se sada stvarno vide na render-u** (bila UI/state-only
    scaffolding, decisions.md #33). Implementacija: svaki žleb je sopstveni
    mali `LatheGeometry` prsten (ista tehnika kao sam obruč, samo sitan
    profil) koji sedi tik uz spoljnu površinu trake na širinskoj poziciji
    žleba — čita se kao fin ugraviran/aplicirani greben (millgrain/inlay
    stil), NE kao pravo urezivanje u siluetu trake. Pravo urezivanje (CSG u
    `profilePoints()` po obliku — round/flat/court/d-comfort svaki imaju
    drugačiju geometriju) ostaje v2 zadatak, upisano u roadmap.md. Boja
    žleba prati boju trake živo (svaki frame, `loop()`), hrapavost dolazi iz
    žlebovog "Površina" izbora (Polirano/Mat/Grebano).
41. **Dijamant se sada uvek vidi na render-u kad je selektovan** — ranije
    (26-09-06) `buildStoneFor` je već podržavao niz pozicija, ali je stvarna
    render-provera bila samo konzolnim logom (headless swiftshader kamera
    ovde nikad nije uhvatila dobar ugao za 1.5mm kamen). Sada uz širinsku
    poziciju (#39) i veće/vidljivije test-vrednosti, potvrđeno i vizuelno
    (v. napomenu u sledećoj memoriji).
42. **"Dve boje"/"Tri boje" sada STVARNO menjaju render** (bilo UI-only,
    decisions.md #34→real). Mehanizam: poseban `aBandY` per-vertex atribut
    (LatheGeometry, ista y-osa kao `profilePoints()`) + shader hook (nastavak
    postojećeg `attachBottomShade`/`onBeforeCompile` trika) koji menja
    `diffuseColor.rgb` ODMAH POSLE `#include <color_fragment>` — pre PBR
    metal/specular računice, tako da odsjaj ispravno prati boju svake zone
    (menjanje boje tek na `gl_FragColor` na kraju, kao bottom-shade, dalo bi
    pogrešan "zlatni sjaj na srebrnoj osnovi" efekat). Samo prave
    razmere-po-širini (1:1, 1:2, 2:1, 3:1, 4:1, i 1:1:1/1:2:1/2:1:1 za tri
    boje) su realne; talas/dijagonalno/segment/osovinski i dalje traže
    ugaonu koordinatu koju šejder nema — ostaju "uskoro" (vraćaju null iz
    `colorZonesFor()`, pa se i dalje prikazuje jedna boja). UI dobija po-zonu
    swatch birače ("Deo A"/"Deo B"[/"Deo C"]) umesto jednog "Metal" reda kad
    je pattern != jedna boja; podrazumevane zone biraju različite metale
    automatski (`defaultZones()`) tako da je razlika odmah vidljiva.

43. **Strogi "jedna sekcija odjednom" akordeon je namerno ponašanje —
    potvrđeno klijentom 2026-09-07 posle kratke zabune.** Prvobitno
    razjašnjenje ("nisu zatvoreni nego su display none, nema ih... dok se ne
    klikne sledeća ili gore") je pogrešno pročitano kao ŽALBA na to
    ponašanje, pa je nakratko promenjeno da SVE sekcije budu otvorene
    odjednom (commit `0d0abe4`) — klijent je odmah ispravio: to JESTE
    traženo ponašanje, ne bag. Vraćeno (`38afb4a`): `openSections` počinje
    samo sa Profil-om otvorenim; `gotoStep()` sad EKSPLICITNO zatvara sve
    ostale sekcije pri navigaciji (ne samo otvara ciljnu) — samo trenutni
    korak postoji na strani, ostali su `display:none` dok se ne klikne
    "Sledeće" ili broj gore u navigaciji. Klik na naslov sekcije i dalje
    može ručno da je otvori/zatvori nezavisno.

## Odluke — 2026-09-08/09 (klijent, četvrti/peti krug — izgled + preslikavanje opcija sa Breuning-a)

44. **Izgled/layout (Round 4, 2026-09-08).** Header: svi tekstovi 13px
    (`.zs-topbar *`), logo `height` 34→55px (mark 30→44). Shell širi:
    `--zs-maxw` 1440→1600, novi `--zs-panelw` 380px (desni panel bio 320).
    Prekidač burmi: stari „Njena/Njegova" tabovi iznad viewporta uklonjeni →
    **♂ / ♀ ikonice u donjoj traci sa alatima** (♂ prvo), + **„oko" =
    prikaži samo aktivnu burmu**, ISTI kadar (scene `setSolo(key)`, klijent:
    „isti kadar samo bez drugog prstena"). Profili: **4 → 14**, u 4 grupe
    (Osnovni / Zaobljeni / Ravni / Šiljati profili — `params.group`). 4
    originala zadržavaju ručne oblike; 10 novih koriste `shape:'param'` +
    knobove `dome/cham/taper/belly/point/relief` (0..1) kroz JEDAN generator
    `paramProfileOutline()` koji hrani i 2D crtež kartice i 3D `LatheGeometry`
    (`profilePoints('param', …, outline)`) — svaki profil stvarno renderuje.
    `geomChanged` sad ključa i na `profileKey` (svi param profili dele
    `profileShape='param'`).

45. **Preslikane opcije sa Breuning-a (Round 5, 2026-09-08).** Prošli su svi
    koraci Breuning konfiguratora uporedo (headless browser — v. #48).
    - **Finoća 585/750** dodata u Materijal (`FINOCA` tabela u
      `configurator.js`): 750 podiže `density` → masu (par 9,2→10,9 g kad su
      obe burme 750) i produbljuje boju zlata (`mixHex` ka `#C98A2E` za
      `deepen:0.30`; 585 = bez efekta). `s.finoca` state, default '585'.
    - **Cena po prstenu** („Njena … / Njegova …") uz „Cena za par" u donjoj
      traci (`_ringPrice` se već računao, sad se i prikazuje).
    - **„Primeni na drugu burmu"** dugme u svakoj akordeon sekciji
      (`SECTION_FIELDS` mapa + `copySection()`) = Breuning-ovo „Einstellung
      für Ring 1 übernehmen" po koraku.
    - **Gravura `maxLen` 20 → 30** (Seeder).
    - Maße / Fugen (Designfugen) / Diamanten ocenjeni kao već na paritetu.
      „Inlay"/„Farbwellen" boje, US/UK sistemi veličina, ugaono
      pozicioniranje žlebova — ostaju v2.

46. **Bug fix na osnovu klijentove provere Round 5 (Round 5b, 2026-09-08).**
    - **Dijamant se nije mogao izabrati** — 3 reda kamena (`round-1_0/1_5/2_0`)
      su u Seeder-u imali `available => 0` (stock-gate) pa je `uiChips`
      onemogućavao dugmad. → `available => 1`.
    - **Žleb „Pozicija" nije pomerao 3D** — `grooveProfilePoints()` centrira
      greben na y=0, `buildGroovesFor()` nikad nije primenjivao `grv.position`.
      → `m.position.set(0, grv.position || 0, 0)` (root-local Y = osa širine,
      isto kao `widthPos` kamena).
    - **Gravura se nije renderovala** (bila UI/state samo). → novi
      `buildEngravingFor()` u `scene.module.js`: tekst → canvas → `CanvasTexture`
      → tanak parcijalni `CylinderGeometry` tik uz unutrašnji/spoljni zid
      trake, `MeshBasicMaterial`. **Aproksimacija** (aplicirana tamna slova,
      NE pravo urezivanje sa dubinom — to je i dalje canvas→height/normal
      posao, odluka #8 / Faza 3). Ažurira se dok se kuca (120ms debounce).
    - `window.__zscApp` handle dodat u `mount()` za QA (bezopasna referenca).

47. **Klijentov feedback na Round 5b (Round 5c, 2026-09-09).**
    - **Dijamant je bio postavljen SPOLJA pogrešno → iznutra** (na tankoj
      traci mu je pavilion probijao unutrašnji zid). Sad: `maxScale =
      (thickness − 0.12) / (TABLE_UP + PAV_DOWN)` ograničava kamen da mu
      kulet ostane u metalu (2mm kamen fizički ne staje flush u 1mm traku →
      prikaže se malo manji, ne probija); sto poravnat sa spoljnom površinom
      (`outerR + 0.01`); orijentacija preko
      `quaternion.setFromUnitVectors(+Y, radijalno-napolje)`.
    - **Dijamant „beli kvadratić" → pravi brilijant**: `makeBrilliantGeometry()`
      (12-strani fasetiran round brilliant: sto + kruna + rondiš + pavilion),
      non-indexed → `computeVertexNormals()` daje normalu PO FASETI = svetluca
      i na software GL-u. Materijal: transmission 0.85, ior 2.42, clearcoat 1,
      iridescence 0.45, envMapIntensity 4.5. **Puna vatra se vidi tek na
      pravom GPU-u** (SwiftShader ne ume transmisiju).
    - **Gravura presvetla/prevelika → svetlija i manji font** (Breuning):
      `rgba(48,40,28,0.62)` (bilo ~0.92), 64px tanko (bilo 104px bold), tanja
      traka, `opacity 0.85`, radijus tik iznad zida (`innerR−0.015` /
      `outerR+0.015`) da spoljna varijanta nije uronjena u traku.
    - **Žlebovi korak — UI totalno preuređen po Breuning-ovom „Fugen/Stufen"**:
      tab traka sa donjom linijom · `.zs-profile-grid` kartice oblika · red
      „N žleb(ova)" + „Ukloni sve" + zeleno „Dodaj žleb" · kartica po žlebu =
      numerisani naslov + „Ukloni" + uredni redovi sa labelama (Oblik /
      Površina / **Širina** / **Dubina** sad dropdown-i preko `GROOVE_WIDTHS`/
      `GROOVE_DEPTHS`, ne klizači; Orijentacija pill-ovi; Pozicija broj + „mm"
      sa prikazom raspona) + mini pregled. **Izuzetak od „držimo naš dizajn"**
      — klijent eksplicitno tražio da se za ovaj korak preslika njihov dizajn.

48. **Testiranje: pravi headless browser RADI u ovom okruženju** (2026-09-08).
    Suprotno starijim beleškama („nema browsera u WSL, koristi Windows
    Chrome"), Playwright-ov Chromium je preinstaliran
    (`~/.cache/ms-playwright/chromium-1243`), renderuje WebGL (SwiftShader) i
    ima pristup internetu — korišćen za poređenje sa `konfigurator.breuning.de`
    i za QA našeg UI-ja. `playwright-core` vozi već prisutni binarni fajl.

## Otvorena pitanja (blokiraju procenu obima)

| # | Pitanje | Zašto je bitno |
|---|---|---|
| ~~A~~ | ✅ Rešeno (odluka 22): glatke burme, par, bez CAD glava. | — |
| B | **Finalni frontend framework**: Svelte / SolidJS / React / Preact? | Ne blokira arhitekturu, ali treba pre Faze 4. Lean: Svelte ili Solid (mali runtime). |
| C | **CDN provider**: Bunny / Cloudflare R2 / S3+CloudFront? | Treba pre Faze 3 (upload pipeline za asseti). |
| ~~D~~ | ✅ Rešeno (odluka 23): debljina = zaseban klizač. | — |
| E | **Dijamanti za burme**: 3 veličine (Ø1.0 / 1.5 / 2.0 mm) su sada `available=1` i biraju se; kamen je fasetiran brilijant, flush spolja (#46/#47). Ostaje pitanje: više kamena / pavé red / tipovi postavke — v2. | Obim proceduralnog kamenja + stock logika. |
| E2 | **`.3dm` geometrija**: da li klijent može da izveze `.obj`/`.glb` iz Rhina (mesh, ~50k), ili idemo 100% proceduralno? | Proceduralno je plan (odluka 6) i radi bez Rhina; CAD izvoz treba samo ako se traži tačna geometrija 1:1. |
| F | **Email**: primalac(ci)? kopija kupcu? slika client-side ili server-side? | Faza 5. Odloženo. |
| G | **MODEL/glave kao CPT ili tabela?** | Zavisi koliko bogat editor klijentu treba (slike, opisi). |
| H | **Tačne px veličine/weight-ovi tipografije** — izvući iz Figma Dev Mode. Delimično: header zaključan na 13px, logo 55px, shell 1600 / panel 380 (#44); ostatak type-scale-a još estimacija. | Zaključati type scale u tokene. |
| I | **Finoća** — 585/750 su sada izbor (#45). Cene po gramu za 18k (`au_18k` spot key) nisu unete; da li klijent proširuje ponudu (platina/paládijum, više karata)? | Cena + `spotPrices` u Podešavanjima. |

## Za reviziju kasnije
- Threepipe evaluacija (1 dan) pre nego što se krene sa scene bootstrap-om (Faza 2).
- Da li shank volumen računati i na serveru (duplo) ili verovati klijentu pa validirati grubo.
