# FAZA 4 — METALS + GROOVES SPECIFICATION (Wama Gold)

Reverse engineering metala, podele boja, žlebova i ivica na https://www.wamagold-configurator.com/configurator, urađeno 1. 10. 2026. Ovo je tehnička referenca za Claude Code. Naš plugin u ovoj fazi nije menjan.

**Kako je mereno.** Sve vrednosti su iz četiri izvora koje konfigurator sam koristi:
1. **JSON-RPC stanje prstena** (`disc.*`, `division.*`, `groove.*`, `edge.*`, `separation.*`) i lista dozvoljenih opcija (`possibility.getPossibilities`).
2. **Endpoint za cenu** `…/integration/containers/{id}/price`. Vraća težinu po traci, sastav legure (`pcm`), nabavnu (`ek`) i prodajnu (`vk`) cenu.
3. **Konfiguracija za 3D** (`rings3d…shapeRing.segments`): trake, granice, žlebovi i materijali kako ih dobija 3D engine.
4. **Živa three.js mreža**: presek kroz stvarne verteksе prstena i žlebova.

Sirovi odgovori i zapažanja su u `data/` (posebno `data/observations_log.md`).

Test prsten je, ako nije drugačije navedeno, **P1 (ravan), 5,0 × 1,5 mm, veličina 62 (unutrašnji obim 62 mm), žuto zlato 585, poliran**.

Oznake (po tvom zahtevu):
- **VERIFIED**: pročitano iz podataka konfiguratora ili tačno reprodukovano (npr. cena do zlota).
- **MEASURED**: izmereno iz žive 3D mreže ili izračunato iz izmerenih težina.
- **ESTIMATED**: pravilo izvedeno iz ponašanja, nije direktno potvrđeno.
- **UNKNOWN**: nije bilo moguće utvrditi.

Cene su u PLN za poljski sajt na dan merenja. Služe samo da se razume model računanja, ne kao naše cene.

---

## 0. Ukratko

1. **Metali.** Postoji 5 legura: žuto, belo, crveno, manganovo i belo (Pd). Žuto, belo i crveno se nude u finoćama 333, 375, 585 i 750; manganovo i belo (Pd) samo u 585. Platine, srebra, posebnog „nickel-free" belog i rutenijuma (crnog zlata) u konfiguratoru nema. [VERIFIED]
2. **Promena metala menja samo LUT u 3D, a gustinu i cenu u podacima.** U 3D se menja samo jedan parametar, `gradient` (LUT tekstura boje iz Faze 1). Shader, refleksija i hrapavost su isti za sve metale. Finoća ne menja izgled, ali menja gustinu (10,9 / 11,2 / 13,3 / 15,5 g/cm³), težinu i cenu. Rodijum menja samo cenu. Površinska obrada (mat, čekić…) menja samo spoljašnju površinu; unutrašnjost je uvek polirana. [VERIFIED]
3. **Podela boja ide po širini, ne po obimu.** Prsten se deli na trake koje idu oko celog obima. Granice su ravne radijalne ravni na `x = rez` ili talas `x = rez − A·sin(n·θ)`. Na svakoj granici automatski stoji razdvajajući V-žleb 0,2 × 0,1 mm. Postoje 24 preseta: 1–5 boja, ravni, talasasti, dijagonalni i slobodni. [VERIFIED + MEASURED]
4. **Žlebovi.** Postoji 7 oblika: V60, V90, V120, U, wypukły (konveksni), kvadratni i perlage (kuglice). Sve mere su **apsolutne u mm** i iste za svaki profil, širinu i prsten. Žleb je **ista geometrija projektovana na profil**: V i kvadratni ostaju radijalni, U i konveksni se rotiraju sa nagibom površine. Rekonstrukcija se poklapa sa živom 3D mrežom do ≤ 0,004 mm na 17 preseka. [VERIFIED + MEASURED]
5. **Žleb nema svoj metal.** Nema umetka drugog metala. Žleb nosi metal trake u kojoj se nalazi. [VERIFIED]
6. **Cena = težina × cena po gramu(finoća, klasa) + fiksni dodaci**, a `vk = 2,46 × ek`. Postoje 4 klase: jednostavan, poseban žleb ili ivica, više boja, talas/dijagonala. Klase se ne sabiraju. **Zapremina žleba ne ulazi u cenu**: cena se računa na punu težinu prstena. Reprodukovano tačno za 20 od 20 merenih cena. [VERIFIED]
7. **Muški i ženski prsten** imaju identične opcije, geometriju i cenu za iste parametre. [VERIFIED]

Referentni kod `reference/wamaMetalsGrooves.js` sadrži metale, gustine, cenovni model, konstrukciju žlebova, podelu boja i zapremine. Zajedno sa `wamaProfile.js` iz Faze 3 pokriva ceo lanac PROFILE → GROOVE → METAL SEGMENTS → VOLUME → MASS → PRICE.

---

# PART 1 — METALS

## 1. Popis materijala [VERIFIED]

Izvor: `possibility.getPossibilities` → `disc.color`, `disc.fineness`, `disc.rhodinated`, `disc.ruthinated`, `disc.fairtrade`, `disc.surface`.

| ID (interni) | Naziv u UI (PL) | Boja | Finoće | Tip | Napomena |
|---|---|---|---|---|---|
| `yellow` | Żółte złoto | žuta | 333, 375, 585, 750 | zlato (legura) | |
| `white` | Białe złoto | bela | 333, 375, 585, 750 | zlato (legura) | **niklovo** belo: kod 585 sastav sadrži Ni 8,3 %. Jedino nudi rodijum. |
| `red` | Czerwone złoto | crvena/roze | 333, 375, 585, 750 | zlato (legura) | „rose/red": samo jedna varijanta |
| `manganese` | Manganowe złoto | svetlo siva, hladan ton | samo 585 | zlato sa Pd | kod 585 sastav sadrži Pd 19 %. **Samo jednobojno** (vidi §7). |
| `white-pd` | Białe złoto (PD) | tamnije siva | samo 585 | belo zlato sa paladijumom | sastav osim Au nije prikazan [UNKNOWN] |

Šta **ne postoji** u konfiguratoru:
- platina, srebro, paladijum kao zaseban metal;
- posebna „nickel-free" varijanta belog zlata (beli bez nikla je samo `white-pd`);
- rutenijum. Prekidač `disc.ruthinated` postoji u kodu UI-ja, ali server ga nikad ne nudi, a postavljanje se ignoriše.
- fairtrade. Prekidač `disc.fairtrade` postoji u kodu, ali server ne vraća tu opciju.

## 2. Finoće [VERIFIED]

Sastav (`pcm`) sa endpointa za cenu, u gramima, preračunat u udele. Za 333, 375 i 750 server prikazuje samo Au.

| Metal | Color | Fineness/Karat | Nickel/Palladium | UI label | Notes |
|---|---|--:|---|---|---|
| yellow | žuta | 333 (8 k) | – | Żółte złoto, „333" | gustina 10,9 g/cm³; prikazan samo Au 33,3 % |
| yellow | žuta | 375 (9 k) | – | „375" | 11,2 g/cm³ |
| yellow | žuta | 585 (14 k) | – | „585" | 13,3 g/cm³; Au 58,5 · Ag 8,3 · Cu 27,0 · Zn 6,2 % |
| yellow | žuta | 750 (18 k) | – | „750" | 15,5 g/cm³ |
| white | bela | 333 / 375 / 750 | UNKNOWN | Białe złoto | gustina kao kod žutog iste finoće |
| white | bela | 585 | **Ni 8,3 %** | Białe złoto | 13,3 g/cm³; Au 58,5 · Cu 25,6 · Ni 8,3 · Zn 7,5 % |
| red | crvena | 333 / 375 / 750 | – | Czerwone złoto | gustina kao kod žutog iste finoće |
| red | crvena | 585 | – | Czerwone złoto | 13,3 g/cm³; Au 58,5 · Ag 1,0 · Cu 39,0 · Zn 1,5 % |
| manganese | svetlo siva | 585 | **Pd 19,0 %** | Manganowe złoto | 12,2 g/cm³; ostatak sastava nije prikazan |
| white-pd | siva | 585 | Pd (udeo UNKNOWN) | Białe złoto (PD) | 14,8 g/cm³; prikazan samo Au 58,5 % |

Gustina je izmerena kao težina sa servera podeljena zapreminom preseka (Pappus). Za 333 / 375 / 585 / 750 iznosi tačno **10,9 / 11,2 / 13,3 / 15,5 g/cm³**, ista za žuto, belo i crveno. [MEASURED, reprodukovano do 2·10⁻⁶]

**Finoća je jedna za ceo prsten.** Kad se promeni na jednoj traci, server je promeni na svim (`GreedyAlloyCombination`). [VERIFIED]

## 3. Da li kontrola metala menja boju ili materijal [VERIFIED]

| Promena | 3D: LUT (`gradient`) | 3D: shader / hrapavost / refleksija | Gustina | Težina | Cena | Geometrija |
|---|---|---|---|---|---|---|
| boja (yellow → white …) | **da** (`gradients/{id}.png`) | ne (isti materijal, Faza 1) | samo za manganese i white-pd | samo za manganese i white-pd | samo dodatak za Mn i Pd | ne |
| finoća (333 → 750) | **ne** (isti LUT, provereno na 333/585/750) | ne | **da** | **da** | **da** (cena po gramu) | ne |
| rodijum (samo belo) | **ne** | ne | ne | ne | **+50 ek (+123 vk)** | ne |
| površina (mat, čekić…) | ne | **da, ali samo spoljašnja površina** (`outerMaterial.surface`) | ne | ne | **+15 do +80 ek** | ne |

Zaključak: u 3D je promena metala čista **COLOR CHANGE** (zamena LUT-a). U podacima i ceni je **MATERIAL CHANGE**, ali samo preko finoće (gustina) i dodataka za Mn i Pd. Žuto, belo i crveno iste finoće imaju istu gustinu i istu cenu.

**Površine** (11): polished, sand-matt, bark-style-2, brushed-matt-crosswise, brushed-matt-diagonal, brushed-matt-lengthwise, strong-brushed-matt-lengthwise, diamond-matt, hammered-matt, hammered, ice-matt. Unutrašnja površina (`innerMaterial.surface`) je uvek `polished`. [VERIFIED]

## 4. Detaljna boja metala [MEASURED iz LUT-a, Faza 1]

Svi metali koriste isti shader: refleksija okruženja → LUT po metalu, bez svetala i bez tone mappinga (Faza 1). Razlika među metalima je **isključivo LUT kriva**: koja boja odgovara kojoj osvetljenosti refleksije. Indeks 0 je crna refleksija, 1 bela.

| Metal | boja na indeksu 0,25 (senka) | 0,5 | 0,6 (tipično telo) | 0,75 | 0,9 (odsjaj) | prosečni L* | max zasićenost C* (na indeksu, nijansa) |
|---|---|---|---|---|---|--:|---|
| yellow | #582e17 | #c09841 | #d8b660 | #f1dba4 | #fbf4e3 | 56,5 | 50,4 (0,51; h 84°) |
| red | #562e20 | #ae6344 | #c67f5c | #e2ad8a | #f6dcc8 | 49,4 | 43,9 (0,41; h 47°) |
| white | #4b4747 | #8e8782 | #a8a19c | #ccc9c8 | #ececeb | 54,4 | 4,3 (0,53; h 69°, topao ton) |
| manganese | #4f5056 | #9e9c9f | #b8b6b8 | #d9d8d9 | #f0f0f1 | **58,6** | 3,8 (0,19; h 289°, hladan plavkast ton) |
| white-pd | #383737 | #747170 | #8e8c8b | #b9b7b7 | #e3e1e1 | **48,5** | 1,7 (skoro neutralno sivo) |

Zašto različito izgledaju:
- **Žuto:** najjača zasićenost je u srednjim tonovima. Senke odlaze u braon-narandžasto (nijansa 53°), a odsjaji u skoro belo. Zato zlato „sija" bez žutih odsjaja.
- **Crveno:** tamnije od žutog (L* 49 prema 57). Nijansa je pomerena ka bakarnoj (45–60°), zasićenost je najveća već na 0,41, pa i tamni delovi ostaju obojeni.
- **Belo (Ni):** skoro neutralno, ali sa **toplim sivim tonom** (nijansa 65°, C* ≈ 4). Izgleda kao nerodinirano belo zlato.
- **Belo (Pd):** **najtamnije** (L* 48,5) i najneutralnije (C* < 2). Izgleda kao tamnije, „čeličnije" sivo.
- **Manganovo:** **najsvetlije** (L* 58,6) sa blagim **hladnim, plavkastim** tonom u senkama. Na slikama izgleda kao skoro belo, hladno srebro.
- **Rodijum** ne menja LUT, pa izgleda identično kao belo bez rodijuma (screenshot S3 prema S1).

Ponašanje na ravnoj i zaobljenoj, unutrašnjoj i spoljašnjoj površini: LUT je isti na svim površinama. Razlika dolazi samo od toga šta se reflektuje (ravna traka daje dugačke ravne odsjaje, zaobljena kontinualan prelaz), i to je isto za sve metale. Unutrašnjost je uvek polirana. Grafikon: `figures/fig4_metali_lut.png`.

## 5. Rodijum i rutenijum [VERIFIED]

| | Rodijum (`disc.rhodinated`) | Rutenijum (`disc.ruthinated`) |
|---|---|---|
| Postoji u UI | da, prekidač „Rodowanie" ispod legure | prekidač postoji u kodu, nikad nije prikazan |
| Na koji metal | **samo `white`** (svih finoća) | ni na jedan (opcija `null` za sve boje i površine) |
| Gde se primenjuje | na traku (disc). U višebojnom prstenu po traci. | – |
| Cela površina ili segment | cela traka | – |
| Refleksija / boja u 3D | **bez promene** (isti LUT `white`) | – |
| Cena | **+50 ek** fiksno po prstenu (+123 vk) | – |
| Geometrija | bez promene | – |

Napomena: kada se traci sa rodijumom promeni boja (belo → žuto), zastavica ostaje `true` u stanju, ali se ne naplaćuje (u podacima za cenu stoji `isRhodinated: false`). [VERIFIED]

## 6. Jednobojni prsten: menja se samo metal [VERIFIED]

P1 5,0 × 1,5, veličina 62, poliran, bez žlebova. Zapremina V = 493,30 mm³.

| Metal | Finoća | Težina [g] | Gustina [g/cm³] | ek [PLN] | vk = prikazana cena [PLN] |
|---|--:|--:|--:|--:|--:|
| yellow / white / red | 333 | 5,3770 | 10,9 | 1274,35 | 3135 |
| yellow / white / red | 375 | 5,5250 | 11,2 | 1436,50 | 3534 |
| yellow / white / red | 585 | 6,5609 | 13,3 | 2434,11 | 5988 |
| yellow / white / red | 750 | 7,6462 | 15,5 | 3509,61 | 8634 |
| white 585 + rodijum | 585 | 6,5609 | 13,3 | 2484,11 | 6111 |
| manganese | 585 | 6,0183 | 12,2 | 2282,79 (+50 dodatak) | 5616 |
| white-pd | 585 | 7,3009 | 14,8 | 3073,68 (+365,04 = 50/g) | 7561 |

Screenshotovi: S1 (žuto | belo), S2 (crveno | manganovo), S3 (belo Pd | belo + rodijum).

## 7. Dve i više boja [VERIFIED]

**Preseti** (`division.proto`, 24 komada, kategorije iz UI-ja):

| Kategorija | Preseti (odnos širina traka) |
|---|---|
| jednobojna | `none` |
| dvobojna | `vertical-1-1`, `vertical-1-2`, `vertical-1-3`, `wave-1-1`, `diagonal-1-1` |
| trobojna | `vertical-1-1-1`, `vertical-2-1-1`, `vertical-3-1-1`, `vertical-4-1-1`, `vertical-1-2-1`, `vertical-1-3-1`, `vertical-1-4-1`, `vertical-2-1-2`, `diagonal-1-1-1`, `diagonal-1-2-1`, `diagonal-2-1-2`, `wave-1-1-1`, `wave-1-2-1`, `wave-2-1-2` |
| slobodna | `vertical-free-2`, `vertical-free-3`, `vertical-free-4`, `vertical-free-5` |

Napomena: za `diagonal-1-2-1` i `wave-1-2-1` server je vratio trake 1:1:1, a ne 1:2:1 [VERIFIED, verovatno greška kod njih].

**Pravila:**
- Širina trake = `W · rate / Σrates`. Rez je zbir prethodnih širina, u mm od leve ivice.
- **Granica nije pomerljiva** kod fiksnih preseta. Kod `vertical-free-N` svaki rez je pomerljiv u koracima od 0,01 mm. Spoljne trake moraju biti ≥ 0,6 mm, a unutrašnje ≥ 0,5 mm (iz granica slajdera).
- Talas (`wave-*`): `percentage` je 30, 40, 50, 60 ili 70 (podrazumevano 30), a `numberOfCycles` 1–6 (podrazumevano 2). Dijagonala (`diagonal-*`) je isti sinus sa **1 ciklusom** i istim procentima.
- Amplituda je **A = procenat/100 · W/2**. Na primer 30 % na 5 mm daje 0,75 mm, a 70 % na 8 mm daje 2,8 mm. Amplituda ne zavisi od broja ciklusa.
- Svaka traka ima **svoj metal i svoju površinu** (`disc.color[i]`, `disc.surface[i]`, `disc.rhodinated[i]`). Finoća je zajednička za sve trake.
- Ograničenja kombinacija (`GreedyAlloyCombination`): **manganovo se ne kombinuje**, pa izbor na jednoj traci pretvara sve trake u manganovo. **White-pd** sa finoćom 750 vraća ceo prsten na 585. Žuto, belo i crveno se kombinuju slobodno.
- Promena metala ne menja geometriju trake. U 3D se svaka traka renderuje kao zasebna mreža sa svojim LUT-om.

Cena za više boja ne zavisi od broja traka (izmereno 2, 3, 4 i 5 traka: sve 6424 na P1 5 × 1,5 / 585). Boje žuto, belo i crveno imaju istu gustinu i istu cenu po gramu, pa im je i kombinacija iste cene (izmereno žuto + belo; ostale kombinacije izvedene [ESTIMATED]). Dodaci postoje samo za Mn i Pd:
- 585 ravna podela: 398 PLN/g ek; talas ili dijagonala: 427 PLN/g;
- žuto + belo Pd: 7235 (dodatak 50/g na traci od Pd).

Screenshotovi: S4 (`vertical-1-1` | `vertical-1-2-1`), S5 (`wave-1-1` 50 %, 2 ciklusa | `diagonal-1-1-1`).

## 8. Geometrija segmentacije [VERIFIED + MEASURED]

```
            leva ivica (x = 0)                                      desna ivica (x = W)
 obim  ┌──────────────┬───────────────────────────┬──────────────────┐   ← trake idu oko CELOG obima
 360°  │  traka A     │        traka B            │     traka C      │
       └──────────────┴───────────────────────────┴──────────────────┘
                     rez₁                        rez₂        (rez u mm od leve ivice)
```

- **Prsten se nikad ne deli po obimu.** Ne postoji „segment A od 0° do 180°". Sve podele idu po širini, a svaka traka obuhvata 360°. [VERIFIED: `segments` uvek ima jedan segment, `start 0, end 1`]
- **Granica je radijalna i ravna**: u preseku je to vertikalna linija na `x = rez`, kroz spoljašnju i unutrašnju površinu. Unutrašnja površina se deli na istom x. [MEASURED u 3D mreži]
- **Talas i dijagonala:** granica je `x_b(θ) = rez − A·sin(n·θ)`. U svakom preseku je i dalje radijalna linija; menja se samo njen položaj oko obima. Sve granice jednog prstena imaju isti A, n i fazu. Predznak i fazu nisam mogao da utvrdim [ESTIMATED]; izmeren položaj na dva ugla odgovara formuli do 0,01 mm.
- **Granicu ne čini kosina ili zaobljenje, nego razdvajajući žleb**: automatski V90 širine 0,2 i dubine 0,1, poliran. Dno V-a je tačno na granici, a svaka polovina pripada svojoj traci. Opcije razdvajajućeg žleba su V60, V90, V120, U i kvadratni; širina 0,2–0,5, dubina 0,1–0,25. UI kod ima i `separation.color`, ali server tu opciju ne nudi [UNKNOWN / nije u ponudi].
- **Ne zavisi od profila**: rez je u mm od leve ivice i primenjuje se isto na svaki profil.
- **Ugao segmenta i procenat obima nisu primenljivi**, jer svaka traka pokriva 100 % obima. Procenat širine je `rate/Σrates`.

Slika: `figures/fig3_podela_boja.png` (razvijeno po obimu), `figures/fig1_zlebovi_ravni_profil.png` (presek sa 3 trake).

---

# PART 2 — GROOVES

## 9. Popis žlebova [VERIFIED]

Tab „Rowki / Nacięcia" ima dva podtaba: „Projektowanie rowków" (žlebovi) i „Krawędź" (ivica).

| ID | Naziv u UI (PL) | 3D tip | Oblik | Širine [mm] | Dubine [mm] | Ugao | Radijus | 360° | Seče ili samo menja površinu |
|---|---|---|---|---|---|--:|---|---|---|
| `v-groove-60` | Nacięcie V 60° | `v` | V | 0,2 / 0,3 / 0,4 / 0,5 | vezano: 0,173 / 0,260 / 0,346 / 0,433 | 60° | 0 (oštro) | da | seče |
| `v-groove-90` | Nacięcie V 90° | `v` | V | 0,2 / 0,3 / 0,4 / 0,5 | vezano: 0,10 / 0,15 / 0,20 / 0,25 | 90° | 0 | da | seče |
| `v-groove-120` | Nacięcie V 120° | `v` | V | 0,2 / 0,3 / 0,4 / 0,5 | vezano: 0,058 / 0,087 / 0,115 / 0,144 | 120° | 0 | da | seče |
| `u-groove` | Nacięcie wklęsłe U | `u` | luk (konkavan) | 7 preseta: 0,35×0,03 · 0,5×0,06 · 0,8×0,15 · 1,0×0,27 · 1,5×0,3 · 2,0×0,4 · 1,2×0,6 | | – | luk R = ((w/2)² + d²)/(2d) | da | seče |
| `convex-u-groove` | Wypukły | `bump` | konveksno dno između dva zida | 1,0 / 1,5 | visina 0,1 | – | luk sa strelom 0,1 | da | seče (teme dna je u ravni površine) |
| `square-groove` | Nacięcie kwadratowe | `rect` | pravougaono + kosina 0,1 × 45° | 0,3 / 0,5 / 0,8 / 1,0 / 1,5 / 2,0 | 0,05–0,50, korak 0,05 (nezavisno od širine) | – | 0 | da | seče |
| `perlage` | Kulki ozdobne | `perlageSimple` | kanal + niz kuglica | 0,35 / 0,5 / 0,75 / 0,9 / 1,2 | kanal 0,1 | – | kuglica Ø = 7/9 · w | da | kanal seče, kuglice su dodat metal |

Kod V oblika širina i dubina su zaključane uglom: biraš jedno, drugo sledi. Kod U, izbor širine ili dubine bira ceo preset. Kod kvadratnog su širina i dubina nezavisne. Jedina ponuđena površina žleba je `polished` (perlage nema izbor površine), i svi žlebovi prolaze punih 360°. Na prstenu bez talasaste podele žleb je uvek prav (`amplitude` 0). UI ima prekidač `groove.mirroredSine`; da li žleb prati talas na talasastoj podeli nisam proverio [UNKNOWN].

**Ivica (Krawędź),** posebno za levu i desnu stranu:

| ID | Naziv u UI | Šta je | Širine | Dubine |
|---|---|---|---|---|
| `none` | Brak | – | – | – |
| `normal` | Obniżenie boczne | stepenik (rabbet) na ivici: širina w, dubina d | 0,3 / 0,5 / 0,8 / 1,0 / 1,5 / 2,0 (u višebojnom prstenu samo ono što stane u krajnju traku) | 0,05–0,50, korak 0,05 |
| `perlage` | Kulki ozdobne | kanal sa kuglicama uz ivicu | 0,325 / 0,445 / 0,645 / 0,8 → kuglice 0,30 / 0,39 / 0,54 / 0,70 u kanalu 0,35 / 0,5 / 0,75 / 0,9 | kanal 0,1 |

Screenshot UI ikona: S9.

## 10. Presek žleba [MEASURED iz 3D mreže, pravila VERIFIED]

Koordinate: x je u mm od leve ivice, z je visina iznad linije prsta (kao u Fazi 3). „Površina" je spoljašnji profil iz Faze 3; on se sa 3D mrežom poklapa do 0,001 mm.

**V (60 / 90 / 120)**
- Ivice su na `x = pos ± w/2`, na površini, bez rotacije.
- Dno je na `x = pos`, `z = (z_leve_ivice + z_desne_ivice)/2 − d`, gde je `d = (w/2)/tan(ugao/2)`.
- Zidovi su prave, prelazi oštri, bez zaobljenja.

```
  ──────●           ●──────     ivice na površini
         \         /
          \       /             d = (w/2)/tan(α/2)
           \     /
            \   /
             \ /
              ●                 dno: srednja visina ivica − d
```

**Kvadratni**
- Nominalna širina w je širina dna.
- Sa obe strane je kosina 0,1 × 0,1 (45°) **izvan** w, pa je otvor na površini `w + 0,2`.
- Kosina prati površinu: unutrašnja tačka je 0,1 ispod spoljašnje.
- Zidovi su vertikalni (radijalni), a dno je ravno (konstantan radijus) na `z = min(z leve i desne spoljašnje tačke) − d`.

```
  ─────●                       ●─────
        \                     /          kosina 0,1 × 0,1
         ●                   ●
         │                   │
         │                   │           d (od niže ivice)
         ●───────────────────●           dno širine w
```

**U**
- Kružni luk između ivica, strela `d`, radijus `R = ((w/2)² + d²)/(2d)`. Samo preset 1,2 × 0,6 je polukrug.
- Na obe ivice je mali vertikalni stepenik od 0,01 mm.
- **Na zaobljenom profilu ceo U se rotira** tako da mu je osa normalna na tetivu između ivica. Ivice su na `pos ± (w/2)·cos(nagib)`.

**Wypukły (convex)**
- Dno je luk sa strelom 0,1 čije **teme dodiruje originalnu površinu** na `pos`. Tetiva dužine w leži 0,1 ispod temena, po normali.
- Zidovi idu po normali od površine do krajeva tetive. Na ravnom profilu su duboki 0,1, a na kupoli manje (0,1 − strela kupole; P16 6 × 2 daje 0,072).
- Rotira se sa nagibom kao U.
- Vizuelno je to zaobljena traka u blagom udubljenju.

**Perlage**
- Kanal je kvadratni žleb širine w, dubine 0,1, sa kosinom 0,05.
- Kuglice imaju Ø = 7/9 · w (0,272 / 0,389 / 0,583 / 0,700 / 0,933; vrednosti `perlageWidth` iz 3D konfiguracije [VERIFIED]) i dodiruju se po obimu. Izmereno: 104 kuglice Ø 0,70 na P16 6 × 2 i 79 kuglica Ø 0,933 na P1 8 × 2. Formula `broj = floor(2π · R_dna_kanala / Ø)` daje oba broja [ESTIMATED].
- Kuglice vire iznad površine: 0,17 mm za Ø 0,933 [MEASURED]. Tačan 3D oblik kuglice (sfera ili spljošten) nisam utvrdio [ESTIMATED].

**Ivica „normal":** pod je na `z_površine − d`, od ivice prstena do x = w, i spaja se sa zaobljenjem ugla. U engine-u je to `rect` žleb širine 2w centriran na ivici.

Tačnost rekonstrukcije (`wamaMetalsGrooves.js` → `grooveOutline`) prema živoj mreži, 17 preseka na P1, P16 i P11: najveće odstupanje je **0,0037 mm** (U rotiran na P16), a ostali preseci su ≤ 0,001 mm. Detalji su u `data/validation_faza4.json`. Slike: `figures/fig1_zlebovi_ravni_profil.png`, `figures/fig2_zlebovi_na_profilima.png`.

## 11. Pozicija žleba [VERIFIED + ESTIMATED]

- **Pozicija je centar žleba u mm od leve ivice prstena (apsolutno)**. Nije u procentima i ne zavisi od profila ni od debljine.
- Granice slajdera u UI-ju: `[m, W − m]`, korak 0,01 mm. Izmereno na podrazumevanoj širini svakog oblika [VERIFIED]: V 0,2 → m 0,4; U 0,35 → 0,325; kvadratni 0,3 → 0,35; perlage 0,5 → 0,25; konveksni → 0. Opšta formula m = w/2 + 0,3 (V), w/2 + 0,15 (U), w/2 + 0,2 (kvadratni), w/2 (perlage) je izvedena [ESTIMATED].
- **Server ima strože pravilo od slajdera** [ESTIMATED iz poruka `MoveGroove` i `grooveCollision`]. Ivica žleba mora biti ≥ 0,5 mm od ivice prstena i ≥ 0,5 mm od susednog žleba. Žlebovi takođe zaobilaze poziciju kamena. Primer: V 0,2 postavljen na 0,4 server pomera na 0,6.
- Kada se doda više žlebova, server ih sam raspoređuje. Na 5 mm: prvi na 2,5, drugi na 3,8, treći na 1,2, četvrti odbijen (`grooveCollision`).

Pozicije za V 0,2 na 5 mm (slajder je linearan):

| Slajder | min | 25 % | 50 % | 75 % | max |
|---|--:|--:|--:|--:|--:|
| pozicija [mm] | 0,40 (server pomera na 0,60) | 1,45 | 2,50 | 3,55 | 4,60 (server pomera na 4,40) |

## 12. Žleb i širina prstena [VERIFIED]

Testirano na 2, 3, 4, 5, 6, 8 i 12 mm:
- **Žleb zadržava istu fizičku širinu i dubinu.** Ništa se ne skalira sa širinom prstena, a liste opcija su iste.
- Menja se samo opseg pozicije `[m, W − m]`.
- Lista U preseta se filtrira prema tome šta staje na trenutnoj poziciji uz 0,5 mm od ivice. Na primer, na 4 mm sa pozicijom 3,175 ostaju samo 0,35 × 0,03 i 0,5 × 0,06.

## 13. Žleb i debljina [VERIFIED + ESTIMATED]

Testirano na 0,8 / 1,0 / 1,2 / 1,5 / 1,8 / 2,0 / 2,5 mm (P1) i 1,0 / 1,5 / 2,5 mm (P16):
- Širina i ugao se ne menjaju, a dubina je i dalje apsolutna.
- **Dozvoljene dubine se skraćuju kod tankih prstenova.** P1 0,8: V60 najviše 0,346, kvadratni najviše 0,40. P16 5 × 1,0: V60 najviše 0,346, kvadratni najviše 0,35.
- Pravilo koje objašnjava sve slučajeve: **dubina ≤ 0,5 × lokalna debljina zida ispod žleba** (najmanja preko širine žleba) [ESTIMATED].
- Žleb ne može da probije profil. Šta se dešava sa već postojećim dubokim žlebom kada se debljina smanji nisam testirao [UNKNOWN].

## 14. Žleb i profil [VERIFIED + MEASURED]

Testirano na P1, P2, P3, P4, P6, P8, P10, P11, P12, P13, P14, P16 i P18: opcije i granice pozicija su identične.

**Odgovor je A, sa dopunom:** geometrija žleba je ista i projektuje se na profil. Pravila projekcije:

| Oblik | Orijentacija | Referenca za dubinu |
|---|---|---|
| V | radijalna (ne rotira se) | srednja visina dve ivice − d |
| kvadratni | radijalna | niža spoljašnja ivica − d; dno je ravno |
| U | rotiran prema nagibu površine | tetiva između ivica; strela d po normali |
| konveksni | rotiran prema nagibu | teme dodiruje površinu; tetiva d ispod po normali |
| perlage | kao kvadratni (kanal) | niža ivica − 0,1 |

Ne postoje posebna pravila po profilu. Profil P1–P24 Wama ne nudi „Round" ni „Diamond" profil (Faza 3, §1.1), pa ti nisu testirani.

## 15. Žleb i metal [VERIFIED]

- **Žleb predstavlja samo fizičko udubljenje.** Nema opcije „drugi metal u žlebu" i nema umetka.
- Površina žleba dobija metal trake u kojoj leži. Razdvajajući žleb na granici deli se na dve polovine, svaka sa metalom svoje trake.
- Engine poznaje tip `colorit` (obojeni žleb), ali Wama ga ne koristi. `separation.color` postoji u UI kodu, ali bez ponude sa servera.
- Žleb ne menja cenu kroz zapreminu (§17), nego samo kroz klasu (§22).

## 16. Dubina žleba i materijal

Nije primenljivo: nema umetka drugog metala. `groove depth` je dubina reza u osnovnom metalu, a ispod je uvek isti metal trake.

## 17. Zapremina žleba [MEASURED + VERIFIED]

Zapremina se dobija po Pappusu: `V = A_žleba · 2π · (R_in + z_težišta)`, a masa je `V · ρ`. Površine preseka:

| Oblik | Površina preseka A |
|---|---|
| V | `w·d/2` |
| kvadratni | `w·d + 0,1·0,1` (dve kosine po ½·0,1·0,1) |
| U | površina kružnog odsečka: `R²·acos((R−d)/R) − (R−d)·√(2Rd − d²)` + `0,01·w` |
| konveksni | `w·h − površina odsečka (strela h)`; na ravnom profilu ≈ `w·h/3` |
| perlage | kanal `w·0,1 + 0,05²` minus zapremina kuglica (dodat metal) [ESTIMATED za kuglice] |

Primeri na P1 5 × 1,5, žuto 585 (puna tabela je u `data/groove_volumes_P1_5x1.5.md`):

| Žleb | Uklonjena površina [mm²] | Uklonjeno [mm³] | Uklonjeno [g] (model) | Server: promena težine u stanju [g] |
|---|--:|--:|--:|--:|
| V90 0,2 | 0,0100 | 0,71 | 0,0095 | 0,0095 |
| V60 0,5 | 0,1083 | 7,63 | 0,1015 | 0,0975 |
| U 1,2 × 0,6 | 0,5770 | 40,27 | 0,5357 | 0,6659 (računa w·d) |
| kvadratni 0,5 × 0,3 | 0,1600 | 11,28 | 0,1501 | 0,1406 (bez kosina) |
| konveksni 1,5 | 0,0497 | 3,54 | 0,0470 | 0 |
| perlage 1,2 (samo kanal) | 0,1225 | 8,71 | 0,1159 | 0 |

**Kako Wama računa:**
- Težina u stanju (`profile.sumWeight`) je numerička aproksimacija: U kao pravougaonik w·d (6 od 7 preseta; 0,35 × 0,03 odstupa), kvadratni bez kosina, konveksni i perlage = 0.
- **Cena koristi punu težinu bez ijednog žleba, ivice i razdvajajućeg žleba** (`price.meta.DTO.discs[].weight`) [VERIFIED].
- Po traci: `težina = ρ_trake · A_trake · 2π · R_težišta_trake`. Na primer, traka od 1 mm pune visine na P1 5 × 1,5 ima 1,33091 g. Model reprodukuje težine traka do 8·10⁻⁶.

Za naš sistem: `glavni metal = Σ traka (A_trake − A_žlebova u traci)`, a sekundarnog metala nema.

## 18. Žleb kod muškog i ženskog prstena [VERIFIED]

Isti profil, širina, debljina i žleb (P1 5 × 1,5, V60 0,5 na 1,5) daju identično stanje, 3D konfiguraciju i težinu (6,46347 g). Cena je ista (6198), osim dela za kamen (desni prsten nosi dijamant 0,002 ct). Lista opcija je ista za oba prstena.

## 19. Kombinacije žlebova [VERIFIED + ESTIMATED]

- Broj žlebova nije ograničen brojem, nego prostorom. Na 5 mm stanu 3 × V90 0,2 (četvrti je odbijen), a na 8 mm konveksni, dva U i perlage (4 žleba).
- Minimalni razmak između ivica žlebova je 0,5 mm, a od ivice prstena takođe 0,5 mm [ESTIMATED].
- Kada je pozicija u zabranjenoj zoni, server **pomera** žleb (`MoveGroove`). Ako proširenje žleba izazove sudar, server **odbija** promenu (`grooveCollision`) i zadrži staro stanje.
- Korisnik pozicionira slobodno (slajder i numerički unos), u koracima od 0,01 mm. Preset kombinacija nema.
- Žlebovi se u stanju sortiraju po poziciji, pa se `grooveId` menja.
- Žleb i podela boja postoje istovremeno. Žlebovi se seku po trakama, a razdvajajući žlebovi su dodatni.

## 20. UI ikona i stvarni 3D žleb [VERIFIED]

| Žleb | Ikona | 3D | Razlika |
|---|---|---|---|
| V60 / V90 / V120 | V tri ugla | isto | nema |
| U | skoro polukrug | polukrug samo za 1,2 × 0,6; ostali preseti su plitki lukovi (0,35 × 0,03 je skoro ravan) | **ikona preteruje dubinu** |
| Wypukły | ispupčenje u udubljenju | konveksno dno čije teme je u ravni površine | ikona je u redu |
| Kwadratowe | pravougaoni zarez, oštre ivice | pravougaonik + kosina 0,1 × 45° | **ikona nema kosine** |
| Kulki ozdobne | kuglice u kanalu | kanal + kuglice koje vire iznad površine | ikona je u redu |

Za naš plugin je merodavna 3D geometrija, ne ikone.

## 21. Screenshot dokumentacija

Screenshotove sam sačuvao na tvom računaru i stižu kao prilozi uz ovaj odgovor. U paketu je `screenshots/INDEX.md` koji ih razvrstava u traženu strukturu `FAZA4/metals/...` i `FAZA4/grooves/...` sa kontekstom (profil, širina, debljina, metal, žleb, pozicija). Snimani su u prikazu para, oba prstena veličine 62. Desni prsten nosi mali dijamant (podrazumevani kamen koji nisam mogao da uklonim kroz API).

---

## 22. FINALNA TABELA — METALS

| ID | Name | Color | Fineness | Material type | Density behavior | Price behavior | Notes |
|---|---|---|--:|---|---|---|---|
| yellow-333 | Żółte złoto | žuta | 333 | Au legura | 10,9 g/cm³ | 237 PLN/g ek (osnovno) | prikazan samo Au |
| yellow-375 | Żółte złoto | žuta | 375 | Au legura | 11,2 | 260 | |
| yellow-585 | Żółte złoto | žuta | 585 | Au-Ag-Cu-Zn | 13,3 | 371 | 58,5/8,3/27,0/6,2 % |
| yellow-750 | Żółte złoto | žuta | 750 | Au legura | 15,5 | 459 | |
| white-333/375/750 | Białe złoto | bela (topla siva) | 333/375/750 | Au legura | 10,9 / 11,2 / 15,5 | kao žuto iste finoće | rodijum moguć |
| white-585 | Białe złoto | bela (topla siva) | 585 | Au-Cu-Ni-Zn (**Ni 8,3 %**) | 13,3 | 371 | rodijum +50 ek, bez vizuelne promene |
| red-333/375/750 | Czerwone złoto | crvena | 333/375/750 | Au legura | kao žuto | kao žuto | |
| red-585 | Czerwone złoto | crvena | 585 | Au-Ag-Cu-Zn | 13,3 | 371 | 58,5/1,0/39,0/1,5 % |
| manganese-585 | Manganowe złoto | svetla hladna siva | 585 | Au-Pd (Pd 19 %) | **12,2** | 371 + **50 ek po prstenu** | samo jednobojno |
| white-pd-585 | Białe złoto (PD) | tamnija siva | 585 | Au-Pd | **14,8** | 371 + **50 ek po gramu** trake | ostatak sastava UNKNOWN |
| platinum / silver / palladium | – | – | – | UNKNOWN (ne postoji u konfiguratoru) | – | – | |
| rhodium (obrada) | Rodowanie | – | – | samo za `white` | bez promene | +50 ek | bez promene LUT-a |
| ruthenium (obrada) | – | – | – | ne nudi se | – | – | UNKNOWN |

## 23. FINALNA TABELA — GROOVES

| ID | Name | Type | Width [mm] | Depth [mm] | Radius | Angle | Position | Profile dependency | Metal support |
|---|---|---|--:|--:|---|--:|---|---|---|
| v-groove-60 | Nacięcie V 60° | V | 0,2–0,5 | w·0,866 (0,173–0,433) | 0 | 60° | centar, mm od leve ivice; ivica ≥ 0,5 od ivice prstena | projekcija; radijalan; dubina od srednje visine ivica | nema (metal trake) |
| v-groove-90 | Nacięcie V 90° | V | 0,2–0,5 | w/2 (0,10–0,25) | 0 | 90° | isto | isto | nema |
| v-groove-120 | Nacięcie V 120° | V | 0,2–0,5 | w·0,289 (0,058–0,144) | 0 | 120° | isto | isto | nema |
| u-groove | Nacięcie wklęsłe U | U luk | 7 preseta 0,35–2,0 | 0,03–0,6 (vezano za preset) | ((w/2)²+d²)/(2d) | – | isto (filtrira presete po prostoru) | projekcija; rotiran prema nagibu | nema |
| convex-u-groove | Wypukły | konveksno dno | 1,0 / 1,5 | 0,1 | strela 0,1 | – | slajder 0…W | projekcija; rotiran; teme u ravni površine | nema |
| square-groove | Nacięcie kwadratowe | pravougaonik + kosina 0,1 | 0,3–2,0 | 0,05–0,50 nezavisno; ≤ 0,5 · lokalna debljina [ESTIMATED] | 0 (kosina 45°) | – | isto | projekcija; radijalan; ravno dno od niže ivice | nema |
| perlage | Kulki ozdobne | kanal + kuglice | 0,35–1,2 | kanal 0,1 | kuglica Ø 7/9·w | – | isto | kanal kao kvadratni | nema |
| separation (auto) | (granica boja) | V90 podrazumevano | 0,2 (0,2–0,5) | 0,1 (0,1–0,25) | 0 | 90° | tačno na rezu | isto kao V | dve polovine, svaka sa metalom svoje trake |
| edge normal | Obniżenie boczne | stepenik na ivici | 0,3–2,0 | 0,05–0,5 | 0 | – | leva i/ili desna ivica | prati zaobljenje ugla | nema |
| edge perlage | Kulki ozdobne (ivica) | kanal + kuglice uz ivicu | 0,325 / 0,445 / 0,645 / 0,8 | kanal 0,1 | kuglica 0,30–0,70 | – | uz ivicu | – | nema |

## 24. FINALNA TABELA — COMBINATIONS (test slučajevi koje Claude Code može da reprodukuje)

Svi su na veličini 62. Rezultat je težina za cenu (puna) i prikazana cena (vk, PLN). Svi su izmereni [VERIFIED]. `wamaMetalsGrooves.js` reprodukuje tačno sve redove osim poslednjeg: P16 red sadrži i dijamant (+70,38 ek), koji model ne pokriva, a model profila P16 daje 9,3177 g umesto 9,3206 g.

| Profile | Width | Thickness | Metal | Groove | Secondary Metal | Result |
|---|--:|--:|---|---|---|---|
| P1 | 5,0 | 1,5 | yellow 585 | – | – | 6,5609 g · 5988 |
| P1 | 5,0 | 1,5 | yellow 333 | – | – | 5,3770 g · 3135 |
| P1 | 5,0 | 1,5 | yellow 750 | – | – | 7,6462 g · 8634 |
| P1 | 5,0 | 1,5 | white 585 + rodijum | – | – | 6,5609 g · 6111 |
| P1 | 5,0 | 1,5 | manganese 585 | – | – | 6,0183 g · 5616 |
| P1 | 5,0 | 1,5 | white-pd 585 | – | – | 7,3009 g · 7561 |
| P1 | 5,0 | 1,5 | yellow 585, hammered | – | – | 6,5609 g · 6185 |
| P1 | 8,0 | 1,5 | yellow 585, hammered | – | – | 10,5537 g · 9829 |
| P1 | 5,0 | 1,5 | yellow 585 | V90 0,2 na 2,5 | – | 6,5609 g · 5988 (stanje 6,5515 g) |
| P1 | 5,0 | 1,5 | yellow 585 | V60 0,5 na 2,5 | – | 6,5609 g · 6198 |
| P1 | 5,0 | 1,5 | yellow 585 | U 1,2 × 0,6 | – | 6,5609 g · 6198 (realno uklonjeno 0,536 g) |
| P1 | 5,0 | 1,5 | yellow 333 | kvadratni 0,3 × 0,05 | – | 5,3770 g · 3347 |
| P1 | 5,0 | 1,5 | yellow 585 | – (`vertical-1-1`) | white 585 | 3,2805 + 3,2805 g · 6424 |
| P1 | 5,0 | 1,5 | yellow 585 | – (`wave-1-1` 30 %, 2 ciklusa) | white 585 | 3,2805 + 3,2805 g · 6892 |
| P1 | 5,0 | 1,5 | yellow 750 | – (`vertical-1-1`) | white 750 | 3,8231 + 3,8231 g · 9085 |
| P1 | 5,0 | 1,5 | yellow 585 | – (`vertical-1-1`) | white-pd 585 | 3,2805 + 3,6505 g · 7235 |
| P1 | 5,0 | 1,5 | yellow 585, hammered | – (`vertical-1-1`) | white 585 + rodijum | 6,5609 g · 6743 |
| P1 | 6,0 | 1,5 | yellow 585 | ivica levo normal 0,3 × 0,05, desno perlage 0,445 (`vertical-1-2-1`) | white-pd + red 585 | 1,9496 + 4,4430 + 1,9496 g · 8714 |
| P16 | 6,0 | 2,0 | yellow 585 | V90 0,5 + konveksni 1,5 + perlage 0,9 + dijamant 0,002 ct | – | 9,3206 g · 8978 |

---

## 25. REKONSTRUKCIJA ZA NAŠ PLUGIN

### METALS — IMPLEMENTATION SPEC

**Svojstva metala u CMS-u** (jedna stavka = boja + finoća):

| Polje | Primer | Za šta služi |
|---|---|---|
| `id` | `yellow-585` | ključ |
| `colorId` | `yellow` | izbor LUT-a / boje u shaderu |
| `label` (po jeziku) | Żółte złoto 585 | UI |
| `fineness` | 585 | prikaz, žig, cena |
| `density_g_cm3` | 13,3 | masa |
| `pricePerGram` | po klasi: simple / special / multi / wavy | cena (vidi dole) |
| `surchargeFlat` | 0 (manganese 50) | cena |
| `surchargePerGram` | 0 (white-pd 50) | cena |
| `allowRhodium` | true samo za belo | UI i cena |
| `rhodiumSurcharge` | 50 | cena |
| `canCombine` | false za manganese | pravilo podele |
| `allowedFinenessesForColor` | white-pd → [585] | pravilo |
| `composition` | opciono | sertifikat i opis |

- **Frontend dobija** `colorId` (LUT), `label`, `fineness`, `allowRhodium` i pravila kombinovanja. Gustina i cene ostaju na serveru i u CMS-u.
- **Shader** zavisi samo od `colorId`: jedan LUT po boji, isti za sve finoće (Faza 1 i 2). Rodijum ne menja shader (kod Wame). Ako mi želimo da rodijum izgleda belje, to je naša odluka, ne kopija Wame.
- **Površinska obrada** je zaseban parametar po traci: menja samo spoljašnji materijal, unutrašnjost je uvek polirana, i ima fiksan dodatak u CMS-u.
- **Gustina** zavisi od boje i finoće (tabela iz §2). Masa je `Σ_trake V_trake · ρ_trake`.
- **Cena:** `cena = Σ_trake masa_trake · pricePerGram[finoća][klasa] + dodaci`. Klasa = max(talas → wavy, više traka → multi, poseban žleb ili ivica → special, inače simple). Dodaci: površina (jednom po prstenu: dve trake sa hammered daju jedan dodatak, izmereno), rodijum, manganovo (fiksno), Pd po gramu, kamenje. Ako CMS čuva cene po gramu, konačna cena je `ek × marža` (Wama: 2,46).
- **Višemetalni prstenovi:** lista traka `[{colorId, surface, rhodium}]` + `division {type: vertical|wave|diagonal, rates[], cuts[] (free), percentage, cycles}`. Finoća je jedna po prstenu. Pravila: manganovo samo jednobojno, white-pd forsira 585.

### GROOVES — IMPLEMENTATION SPEC

**Definicija žleba** (lista po prstenu, sortirana po poziciji):

```json
{ "form": "v-groove-60|v-groove-90|v-groove-120|u-groove|convex-u-groove|square-groove|perlage",
  "position": 2.50,            // mm od leve ivice, centar žleba
  "width": 0.5,                // mm (V: 0.2–0.5; U: preset; square: 0.3–2.0; convex: 1.0/1.5; perlage: 0.35–1.2)
  "depth": 0.433,              // mm (V: izvedeno iz ugla; U: iz preseta; square: 0.05–0.5; convex 0.1; perlage 0.1)
  "surface": "polished" }
```

Ivica: `edges: { left: {form: none|normal|perlage, width, depth}, right: {...} }`. Razdvajanje: `separation: {form, width, depth}`, primenjuje se na svaki rez podele.

- **Pozicioniranje:**
  - slajder `[m, W − m]` u koracima od 0,01;
  - validacija: ivica žleba ≥ 0,5 mm od ivice prstena i od susednih žlebova, i van zone kamena;
  - kod sudara: pomeri žleb ili odbij promenu (Wama: `MoveGroove` / `grooveCollision`);
  - auto-pozicija novog žleba: centar, pa naizmenično desno i levo.
- **Konstrukcija na profilu** (`grooveOutline` u referentnom JS-u):
  - uzmi spoljašnju površinu profila iz Faze 3 kao funkciju z(x);
  - zameni deo između ivica oblikom iz §10: V i kvadratni radijalni, U i konveksni rotirani po nagibu;
  - unutrašnja površina se nikad ne menja.
- **Širina i debljina:** mere žleba su apsolutne. Lista dubina se filtrira po pravilu `d ≤ 0,5 · t_lokalno`, a lista U preseta po prostoru.
- **Segmentacija:** žleb se seče po trakama (svaki deo nosi metal svoje trake). Razdvajajući žleb je dno V-a tačno na rezu.
- **Zapremina:** `V_žleba = A · 2π · (R_in + z_težišta)` po formulama iz §17. Masa traka je `(A_trake − Σ A_žlebova u traci) · 2π · R_težišta · ρ`. Za talasaste granice integrali po θ (referentni JS daje straight-cut aproksimaciju; Wama za cenu radi isto).
- **Cena:** Wama ne oduzima zapreminu žleba, nego naplaćuje klasu (+13 PLN/g ek na 585 za V60, U, kvadratni, perlage i ivice; V90, V120 i konveksni su besplatni). **Preporuka za nas:** masu računati realno (sa oduzetom zapreminom), a rad naplaćivati preko klase ili dodatka po žlebu iz CMS-a. Tako masa i žig ostaju tačni.

## 26. Nepoznato i procene

- **Sastav** legura 333, 375 i 750 i ostatak sastava za manganovo i white-pd: server ih ne prikazuje [UNKNOWN].
- **Pravilo razmaka** 0,5 mm (ivica i susedni žleb) i pravilo dubine `≤ 0,5 · t_lokalno` su izvedeni iz ponašanja [ESTIMATED].
- **Faza talasa** (predznak sinusa i početni ugao) [ESTIMATED]. Amplituda i broj ciklusa su VERIFIED.
- **Tačan 3D oblik kuglica** perlage (sfera ili spljošteno) i njihova zapremina [ESTIMATED]. Prečnik i broj su MEASURED.
- **Konveksni na kupoli:** model 0,001 mm, ali proveren samo na jednoj poziciji [MEASURED].
- **Ponašanje postojećeg dubokog žleba** kada se debljina smanji [UNKNOWN].
- **Da li dizajnerski žleb prati talas** na talasastoj ili dijagonalnoj podeli (prekidač `mirroredSine`) [UNKNOWN].
- **Nazivi `ek`/`vk`** (verovatno Einkaufspreis i Verkaufspreis) [ESTIMATED]. Brojevi su VERIFIED.
- **Model profila iz Faze 3** za P4 3 × 2 i P18 6 × 1,5 daje težinu 1–2 % nižu od servera (tabelarni i fit profili van merenih tačaka). Za P1 i P16 tačnost je ≤ 0,03 %.
- **Kamen na desnom prstenu** nisam uspeo da uklonim kroz API, pa je prisutan na screenshotovima desnog prstena.

---

## Prompt za Claude Code (Faza 4 — mapiranje i plan, bez izmena)

```
Pročitaj docs/faza4/FAZA4-metali-i-zlebovi.md i docs/faza4/reference/wamaMetalsGrooves.js (uz docs/faza3/reference/wamaProfile.js).
Konkurentski konfigurator je source of truth. Ne menjaj kod u ovom koraku.
1. Pronađi u našem pluginu: model metala (boje, finoće, gustine, cene u CMS-u), podelu na više boja, žlebove i ivice,
   računanje zapremine/mase/cene. Navedi fajlove i funkcije.
2. Napravi tabelu razlika naš ↔ Wama za §22, §23 i §25 (šta imamo, šta nedostaje, šta je drugačije).
3. Reprodukuj test slučajeve iz §24 u našem sistemu (masa i cena) i prikaži odstupanja.
4. Predloži plan implementacije po koracima (CMS polja, frontend, shader/LUT, geometrija žlebova, segmentacija, masa, cena),
   sa listom fajlova i redosledom. Zatim stani i čekaj moje odobrenje.
```
