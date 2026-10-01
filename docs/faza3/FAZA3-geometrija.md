# Faza 3: geometrija profila i stvarna debljina (Wama Gold)

Reverse engineering profila i debljine na konfiguratoru https://www.wamagold-configurator.com/configurator, urađeno 1. 10. 2026. Ovo je tehnička referenca za Claude Code. Naš kod u ovoj fazi nije menjan.

Oznake pouzdanosti:
- **[EXTRACTED]**: vrednost je pročitana direktno iz podataka koje konfigurator šalje pregledaču.
- **[DERIVED]**: izračunato tačno iz izvučene geometrije (debljina na ivici, površina, prosečna debljina).
- **[ESTIMATED]**: fit, interpolacija ili zaključak koji nije direktno izmeren. Uz svaku procenu piše kako je dobijena.

---

## 0. Ukratko

1. **Izvor geometrije.** Konfigurator za svaku promenu od servera dobija tačan 2D presek prstena: `profileCrossSection.svg` i `rings3d…shapeRing` sa segmentima i lukovima u mm. Od istih podataka pravi 3D model i računa težinu. Zato podaci ispod nisu procena sa slike, nego njihova sopstvena geometrija. [EXTRACTED]
2. **Šta znači debljina.** Nominalna debljina H („wysokość") je radijalna razdaljina od **unutrašnjeg vrha** preseka do **spoljašnjeg vrha** preseka. Unutrašnji vrh je tačka koja dodiruje prst i leži tačno na unutrašnjem obimu, tj. na veličini prstena. [EXTRACTED, dokazano na 3 nezavisna načina, §2]
3. **H nije debljina materijala na ivici.** Kod profila sa kupolom i comfort unutrašnjošću, prsten od 1,5 mm je 0,25 mm od bočne ivice debeo samo **0,62–0,99 mm**, a prosečno **1,13–1,32 mm**. [DERIVED, §1, §6]
4. **Fiksne mere u mm.** Zaobljenja i kosine su apsolutne mere i ne skaliraju se sa širinom ni debljinom: gornji ugao r 0,3, unutrašnji ugao r 0,4, kosina 0,52 × 0,52 mm. Kada se H poveća, kod većine profila raste samo **ravan bočni zid**. Unutrašnje zaobljenje se smanjuje kada nema mesta. [EXTRACTED]
5. **Dubina kupole zavisi od profila.** Kod nekih profila dubina zavisi samo od H (P2, P5, P9, P10, P11, P13), kod nekih od širine (P15–P24), a P4 kombinuje oba. To nije uniformno skaliranje jednog oblika. [EXTRACTED + formule, §8]
6. **Prsten 1 i prsten 2** („muški" i „ženski") za iste parametre imaju identičnu geometriju i težinu. Veličina prstena ne menja presek. [EXTRACTED]
7. **Referentni kod.** Napravio sam `wamaProfile.js`, koji ponovo pravi njihov presek za svih 24 profila. Proveren je na 242 izmerena preseka: medijana odstupanja je **0,004 mm** (to je korak uzorkovanja), 97 % slučajeva je ispod 0,05 mm, a najveće odstupanje je 0,087 mm. [DERIVED, §7]
8. **Zašto naš prsten deluje deblji:** naš kod u ovoj sesiji nije bio dostupan, pa uzrok nije potvrđen merenjem. Najverovatniji geometrijski uzroci, sa izračunatim efektom, i tačan postupak da Claude Code to izmeri su u §10.

---

## 1. Analiza profila

Konfigurator nudi **24 profila (P1–P24)**. [EXTRACTED] Server uz svaki profil šalje i metapodatke (`possibility.getPossibilities`): tip `Simple`, `MG3_MG7` (P7, P8) i `Pr006` (P13, P14), unutrašnju ivicu (`IET`: round/slope) i spoljašnju ivicu (`OET`: round/bevel/slope).

### 1.1 Mapiranje na uobičajene nazive

Ovo su moji opisni nazivi, Wama koristi samo šifre P1–P24.

| Uobičajeni naziv | Najbliži Wama profil | Napomena |
|---|---|---|
| Flat / ravni (comfort uglovi) | **P1** | ravan vrh i ravna unutrašnjost; uglovi r 0,3 gore i r 0,4 dole |
| Square | P1 | oštrog kvadratnog profila nema |
| Flat + comfort (ravno spolja, kupola iznutra) | **P2** | |
| Concave / udubljen | **P3** | jedini profil sa udubljenim vrhom |
| Court / comfort lens (kupola gore i dole) | **P4**, **P10** | P10 je simetričan; kod P4 je gornja kupola plića |
| Beveled / kosina 45° | **P6** (ravno iznutra), **P5** (comfort iznutra) | kosina 0,52 × 0,52 mm |
| Trapezoid / široka kosina | **P8** (ravno iznutra), **P7** (comfort iznutra) | kosina zavisi od širine |
| D-profil (kupola gore, ravno iznutra) | **P11** (ugao r 0,4), **P9** (unutrašnji ugao raste sa H) | |
| Soft square / „jastuk" | **P12** | ravan vrh, uglovi r 0,8, comfort iznutra |
| Bombé + unutrašnja kosina | **P13** (kupola), **P14** (ravno) | tip Pr006 |
| Bombé / half-round porodica (kupola + zid + comfort) | **P15–P24** | P15 i P19 su najpliće kupole, P18, P17 i P24 najdublje |
| Half-round, Round, Knife edge, Diamond | nema | najbliži „half-round" je P18 (kupola duboka 0,76 mm na 5 mm) |

### 1.2 Svi profili na 5,0 × 1,5 mm, veličina 62 (EU = unutrašnji obim 62 mm)

Kolone t su izvedene iz izvučenog preseka [DERIVED]. Ključna geometrija je izvučena iz podataka [EXTRACTED]. Jedinice su mm.

| Profil | Širina W | Nominalna debljina H | Stvarna debljina: centar | Stvarna debljina: 0,25 mm od ivice | Stvarna debljina: prosek (A/W) | Unutr. Ø | Spolj. Ø | Ključna geometrija (gore → zid → unutra) |
|---|--:|--:|--:|--:|--:|--:|--:|---|
| P1 | 5.0 | 1.5 | 1.50 | 1.47 | 1.48 | 19.74 | 22.74 | ravan vrh · r0.3 · zid 0.8 · r0.4 · ravno iznutra |
| P2 | 5.0 | 1.5 | 1.50 | 0.98 | 1.28 | 19.74 | 22.74 | ravan vrh · r0.3 · zid 0.308 · r0.4 · kupola R5.13 |
| P3 | 5.0 | 1.5 | 1.13 | 0.88 | 1.07 | 19.74 | 22.74 | konkavno R4.97 · r0.52 · r0.512 · kupola R4.97 |
| P4 | 5.0 | 1.5 | 1.50 | 0.66 | 1.15 | 19.74 | 22.74 | kupola R9.5 · r0.3 · zid 0.044 · r0.3 · kupola R4.7 |
| P5 | 5.0 | 1.5 | 1.50 | 0.87 | 1.29 | 19.74 | 22.74 | ravan vrh · kosina 0.52×0.52 · zid 0.254 · r0.4 · kupola R7.32 |
| P6 | 5.0 | 1.5 | 1.50 | 1.20 | 1.43 | 19.74 | 22.74 | ravan vrh · kosina 0.52×0.52 · zid 0.58 · r0.4 · ravno iznutra |
| P7 | 5.0 | 1.5 | 1.50 | 0.81 | 1.26 | 19.74 | 22.74 | ravan vrh · kosina 0.86×0.45 · zid 0.307 · r0.4 · kupola R7 |
| P8 | 5.0 | 1.5 | 1.50 | 1.15 | 1.41 | 19.74 | 22.74 | ravan vrh · kosina 0.86×0.45 · zid 0.65 · r0.4 · ravno iznutra |
| P9 | 5.0 | 1.5 | 1.50 | 0.91 | 1.27 | 19.74 | 22.74 | kupola R5.28 · r0.3 · zid 0.138 · r0.55 · ravno iznutra |
| P10 | 5.0 | 1.5 | 1.50 | 0.64 | 1.14 | 19.74 | 22.74 | kupola R6.1 · r0.3 · zid 0.033 · r0.3 · kupola R6.1 |
| P11 | 5.0 | 1.5 | 1.50 | 0.97 | 1.28 | 19.74 | 22.74 | kupola R5.28 · r0.3 · zid 0.288 · r0.4 · ravno iznutra |
| P12 | 5.0 | 1.5 | 1.50 | 0.99 | 1.32 | 19.74 | 22.74 | ravan vrh · r0.8 · zid 0.04 · r0.4 · kupola R9 |
| P13 | 5.0 | 1.5 | 1.50 | 0.97 | 1.32 | 19.74 | 22.74 | kupola R22.71 · r0.3 · zid 0.4 · kosina 0.467×0.518 · kupola R12 |
| P14 | 5.0 | 1.5 | 1.50 | 1.09 | 1.37 | 19.74 | 22.74 | ravan vrh · r0.3 · zid 0.5 · kosina 0.442×0.522 · kupola R12 |
| P15 | 5.0 | 1.5 | 1.50 | 0.97 | 1.27 | 19.74 | 22.74 | kupola R9.5 · r0.3 · zid 0.301 · r0.4 · kupola R10 |
| P16 | 5.0 | 1.5 | 1.50 | 0.87 | 1.23 | 19.74 | 22.74 | kupola R7 · r0.3 · zid 0.196 · r0.4 · kupola R10 |
| P17 | 5.0 | 1.5 | 1.50 | 0.80 | 1.21 | 19.74 | 22.74 | kupola R5.5 · r0.3 · zid 0.12 · r0.4 · kupola R12 |
| P18 | 5.0 | 1.5 | 1.50 | 0.64 | 1.14 | 19.74 | 22.74 | kupola R4.5 · r0.3 · r0.331 · kupola R10 |
| P19 | 5.0 | 1.5 | 1.50 | 0.89 | 1.24 | 19.74 | 22.74 | kupola R8 · r0.3 · zid 0.219 · r0.4 · kupola R9 |
| P20 | 5.0 | 1.5 | 1.50 | 0.77 | 1.19 | 19.74 | 22.74 | kupola R6 · r0.3 · zid 0.098 · r0.4 · kupola R9 |
| P21 | 5.0 | 1.5 | 1.50 | 0.77 | 1.19 | 19.74 | 22.74 | kupola R6 · r0.3 · zid 0.098 · r0.4 · kupola R9 |
| P22 | 5.0 | 1.5 | 1.50 | 0.80 | 1.21 | 19.74 | 22.74 | kupola R7 · r0.3 · zid 0.133 · r0.4 · kupola R8 |
| P23 | 5.0 | 1.5 | 1.50 | 0.62 | 1.13 | 19.74 | 22.74 | kupola R6.5 · r0.3 · r0.313 · kupola R5.5 |
| P24 | 5.0 | 1.5 | 1.50 | 0.67 | 1.15 | 19.74 | 22.74 | kupola R5.5 · r0.3 · r0.392 · kupola R7.5 |

H 1,5 je izabrano kao zajednička vrednost jer ga dozvoljavaju svi profili (P13 traži najmanje 1,4 na 5 mm). Presek u razmeri: `figures/fig1_profili_5x1.5.png`.

---

## 2. Definicija debljine

**H = radijalna razdaljina od unutrašnjeg vrha (dodir sa prstom) do spoljašnjeg vrha preseka.**

- **Unutrašnja referenca** je najniža tačka unutrašnje strane preseka. Kod comfort profila to je sredina unutrašnje kupole, a kod ravne unutrašnjosti cela ravna linija. Ta tačka leži tačno na unutrašnjem obimu: `R_in = obim / 2π`. Veličina 62 EU znači obim 62 mm, odnosno Ø 19,735 mm. [EXTRACTED]
- **Spoljašnja referenca** je najviša tačka preseka. Kod kupole i ravnog vrha to je sredina vrha. Kod konkavnog P3 to su obodi na ivicama, pa je P3 u sredini tanji od H (1,13 mm pri H 1,5). [EXTRACTED]
- **Ne meri se** po sredini zida, ne meri se na ivici i ne meri se kao „materijal". To je visina graničnog pravougaonika preseka, merena od linije prsta.
- **Comfort ne dodaje debljinu.** Dubina unutrašnje kupole je unutar H. Ivice zato imaju manje materijala, a unutrašnji prečnik ostaje tačno jednak veličini.

**Dokazi:**
1. API vraća i spoljašnji obim: `outerCircumference − innerCircumference = 2π·H`, tačno za svako merenje. Na primer 69,5398 − 62 = 7,5398 = 2π·1,2. [EXTRACTED]
2. Vertikalni raspon preseka (`max − min`) je tačno H u svih 242 prikupljena preseka (odstupanje < 0,00001 mm). [DERIVED]
3. **Težina:** API vraća težinu u gramima. Ako se ona izračuna kao gustina × površina preseka × 2π × radijus težišta, uz unutrašnji vrh postavljen na `obim/2π`, gustina izlazi **13,300 g/cm³ (585 žuto zlato) u svih 71 preseka za koje je sačuvana serverska težina** (24 na 5 × 1,5 i 47 iz serije debljina i širina). Raspon je 13,29999–13,30001. To dokazuje da je ovaj presek fizički model kojim računaju težinu i da unutrašnji vrh stoji na obimu veličine. [DERIVED]
4. U Fazi 1 je iz 3D mreže izmereno: prsten 1 R_in 9,86 i R_out 11,07 (veličina 62, H 1,2); prsten 2 R_in 8,59 i R_out 9,79 (veličina 54, H 1,2). To se poklapa sa `obim/2π` i `+H`. [EXTRACTED]

Odgovor na pitanje „da li nominalnih 1,5 mm zaista znači 1,5 mm": da, ali samo od vrha do vrha. Debljina 0,25 mm od bočne ivice pri istom H je 0,62–1,47 mm, zavisno od profila (§1.2). To je deo koji oko vidi kao debljinu prstena.

Ilustracija: `figures/fig2_definicija_debljine.png`.

---

## 3. Odnos širine i debljine

### 3.1 Šta se dešava kad raste H (širina ostaje ista)
Pogledati `figures/fig3_H_sweep.png`.
- **P1, P6, P8:** zaobljenja i kosine ostaju iste, raste samo ravan bočni zid (`zid = H − konst.`). [EXTRACTED]
- **P2, P5:** gornja strana ostaje ista. Unutrašnja kupola se produbljuje tako da presek uvek seče bok na istoj visini (P2: 0,10 mm ispod sredine H; P5: 0,31 mm). [EXTRACTED + formula]
- **P9, P11:** dubina gornje kupole iznosi 0,42·H. Kod P9 i unutrašnji ugao raste: `max(0,4, H/2 − 0,2)`. [EXTRACTED + formula]
- **P10:** obe kupole imaju dubinu H/2 − 0,21. [EXTRACTED + formula]
- **P4:** ivica ostaje ≈ 0,44 mm, a ostatak (H − 0,44) se deli na gornju kupolu (≈ 30,5 %) i donju (≈ 69,5 %). [ESTIMATED, fit ±0,04 mm]
- **P15–P24:** gornja kupola ostaje ista (radijus zavisi samo od W), a raste bočni zid. Unutrašnja kupola je od H 1,5 naviše uglavnom ista. Kod H 1,0–1,2 je plića da bi stala (npr. P16 na 5 mm: R 25 pri H 1,0, R 10 od H 1,2 naviše). Izuzetak je P24, kome je na H 2,0 unutrašnja kupola dublja (R 6 umesto 7,5). [EXTRACTED]
- **P7:** unutrašnja kupola zavisi i od H (na 5 mm: R 20 / 7 / 5 pri H 1,2 / 1,5 / 2,0). [EXTRACTED]

### 3.2 Šta se dešava kad raste širina (H ostaje isto)
Pogledati `figures/fig4_W_sweep.png`.
- **Zaobljenja i kosine ostaju apsolutni** (0,3 / 0,4 / 0,52 / 0,8 mm). Kosina P7/P8 je izuzetak i zavisi od širine (tabela u §8).
- Kod profila sa „formula" dubinom (P2, P5, P9–P11, P13, P14) **dubina kupole ne zavisi od širine**, a radijus se računa iz nje: `R = (c² + s²) / 2s`, gde je `c = W/2`. Širi prsten zato ima ravniju kupolu sa istom dubinom; profil se „razvlači" po širini. [EXTRACTED]
- Kod P15–P24 dubina kupole zavisi od širine, po tabeli. [EXTRACTED]
- Zaključak: **nijedan profil se ne dobija uniformnim skaliranjem jednog oblika.** Najbliži „prostom razvlačenju po x" je P10.

### 3.3 Primer 2 × 2 mm i 8 × 2 mm
Isti profil i isti H daju različit oblik: iste apsolutne mere uglova i kosina, ali drugi radijus kupole. Na 2 mm kupola ne može biti dublja od polukruga: radijus ostaje R ≥ W/2 (izmereno R = 1,01–1,10 mm pri W = 2). [EXTRACTED]

### 3.4 Ograničenja i automatske korekcije
- Ponuđene širine: 2,0; 2,2; 2,5; 3,0 … 12,0 mm (22 vrednosti). Debljine: 0,8–2,5 mm u koracima od 0,1 (18 vrednosti). Veličine EU: 45–75 u koracima od 0,5. [EXTRACTED]
- Nedozvoljena kombinacija vraća `profileWidthNotFound` ili `profileHeightNotFound`, i server zadrži prethodne mere. [EXTRACTED]
- Pri **promeni profila** server može sam da promeni H (`HeightAdaptation`). U testu je prelazak sa 5 × 1,2 na P13–P24 podigao H na 1,4, iako P15–P24 posle toga dozvoljavaju ponovni izbor 1,2. Posle promene profila zato uvek treba pročitati stvarni H iz odgovora. [EXTRACTED]
- Granice ispod sam utvrdio binarnom pretragom na 8 profila, sa tačnošću od jednog koraka liste (0,1 mm). Za ostale profile vidi §9.

| Profil | min H @ 2 mm | min H @ 5 mm | min H @ 12 mm | raspon širina | max H |
|---|--:|--:|--:|--:|--:|
| P1 | 0,8 | 0,8 | 0,8 | 2,0–12,0 | 2,5 |
| P2 | 0,8 | 0,8 | 1,0 | 2,0–12,0 | 2,5 |
| P3 | 2 mm odbijeno | 1,2 | 12 mm odbijeno | 2,5–10,0 | 2,5 |
| P4 | 0,8 | 0,8 | 1,2 | 2,0–12,0 | 2,5 |
| P6 | 0,8 | 0,8 | 0,8 | 2,0–12,0 | 2,5 |
| P12 | 2 mm odbijeno | 1,2 | 1,2 | 3,0–12,0 | 2,5 |
| P13 | 2 mm odbijeno | 1,4 | 1,4 | 3,0–12,0 | 2,5 |
| P16 | 0,9 | 1,0 | 1,3 | 2,0–12,0 | 2,5 |

U seriji debljina na 5 mm P18 nije prihvatio H 1,0. [EXTRACTED]

- Opcija „Automatski optimalan odnos širine i visine" (`optimalRatio`) je u testu postavila H = 1,3 za sve širine od 2 do 12 mm (P1, P6, P16). Jedini izuzetak je P1 na 3 mm, sa 1,4. Pravilo nije utvrđeno (§9). [EXTRACTED, uzorak]

---

## 4. Muški i ženski prsten

- Pri istom profilu, širini, debljini i veličini, prsten 1 i prsten 2 dobijaju od servera **identičan presek, obim i težinu**. Provereno na uzorku kombinacija, ne na svim. [EXTRACTED]
- Ne postoji poseban „muški" ili „ženski" profil, niti pravilo tipa „muški je deblji". Oba prstena biraju profil, širinu i debljinu iz istih lista. [EXTRACTED]
- Razlika postoji samo u **podrazumevanim vrednostima** pri otvaranju konfiguratora. Danas (1. 10.) je to: prsten 1 5,0 × 1,2, veličina 62; prsten 2 5,0 × 1,0, veličina 54. U Fazi 1 (30. 9.) prsten 2 je imao H 1,2 (R_out − R_in = 1,20). Podrazumevane vrednosti se, dakle, menjaju. [EXTRACTED]
- **Veličina ne menja presek.** Pri promeni veličine menjaju se samo obimi (`outer = inner + 2πH`) i težina. [EXTRACTED]

---

## 5. Rekonstrukcija preseka

### 5.1 Konstrukcija (ista kod svih profila)
Jedna polovina preseka, od spoljašnjeg vrha ka unutrašnjem:

```text
  spoljašnji vrh (z = H)
      ┌──────── vrh: ravno | kupola R | kosina dx×dy | konkavno R ────────┐
      │ gornje zaobljenje rt (tangentno na vrh i na bok)                   │
      │ ravan bočni zid (dužina = ostatak; može biti 0)                    │
      │ donje zaobljenje ri (tangentno na bok i na unutrašnjost;           │
      │   smanjuje se dok zid ne bude 0 ako nema mesta)                    │
      └──────── unutra: ravno | kupola R | (P13/P14: kosina pa kupola) ────┘
  unutrašnji vrh (z = 0) = linija prsta = obim veličine
```

- Kupola sa vrhom na z = H (ili z = 0): luk poluprečnika R sa centrom na osi simetrije.
- Zaobljenje r tangentno na bok `x = W/2` i na kupolu: centar je na `x = W/2 − r`, a rastojanje do centra kupole je `R − r` (unutrašnja tangenta).
- Konkavni vrh (P3): zaobljenja r dodiruju `z = H` na obodima, a konkavni luk ih spolja tangira (rastojanje centara `R + r`).
- Ivice između kosine i boka, i između kosine i vrha, su **oštre** (P5–P8, P13, P14). Ostali prelazi su tangentni, odnosno glatki.

`builder.py` i `wamaProfile.js` ovom konstrukcijom ponovo prave svih 195 dekodiranih preseka iz matrice (P3 se proverava posebno, §7). Dužina zida se poklapa do 0,0005 mm, što je zaokruživanje u podacima. [DERIVED]

### 5.2 Koordinate (W = 5,0, H = 1,5; x od sredine, z iznad linije prsta, mm) [EXTRACTED]
Ispod su tri tipična profila; svih 24 je u `data/coords_5x1.5.md`.

**P6** (W = 5.0, H = 1.5; x od sredine, z iznad linije prsta)

| deo | od (x, z) | do (x, z) | R | centar (x, z) |
|---|---|---|--:|---|
| ravno (gore) | (0.000, 1.500) | (1.980, 1.500) | – | – |
| kosina | (1.980, 1.500) | (2.500, 0.980) | – | – |
| bočni zid | (2.500, 0.980) | (2.500, 0.400) | – | – |
| zaobljenje | (2.500, 0.400) | (2.100, 0.000) | 0.400 | (2.100, 0.400) |
| ravno (unutra) | (2.100, 0.000) | (0.000, 0.000) | – | – |

**P16** (W = 5.0, H = 1.5; x od sredine, z iznad linije prsta)

| deo | od (x, z) | do (x, z) | R | centar (x, z) |
|---|---|---|--:|---|
| kupola | (0.000, 1.500) | (2.299, 1.112) | 7.000 | (0.000, -5.500) |
| zaobljenje | (2.299, 1.112) | (2.500, 0.829) | 0.300 | (2.200, 0.829) |
| bočni zid | (2.500, 0.829) | (2.500, 0.633) | – | – |
| zaobljenje | (2.500, 0.633) | (2.188, 0.242) | 0.400 | (2.100, 0.633) |
| kupola | (2.188, 0.242) | (0.000, 0.000) | 10.000 | (0.000, 10.000) |

**P13** (W = 5.0, H = 1.5; x od sredine, z iznad linije prsta)

| deo | od (x, z) | do (x, z) | R | centar (x, z) |
|---|---|---|--:|---|
| kupola | (0.000, 1.500) | (2.229, 1.390) | 22.710 | (0.000, -21.210) |
| zaobljenje | (2.229, 1.390) | (2.500, 1.092) | 0.300 | (2.200, 1.092) |
| bočni zid | (2.500, 1.092) | (2.500, 0.692) | – | – |
| kosina | (2.500, 0.692) | (2.033, 0.174) | – | – |
| kupola | (2.033, 0.174) | (0.000, 0.000) | 12.000 | (0.000, 12.000) |

---

## 6. Merenja na više debljina i širina [DERIVED iz izvučenih preseka]

Kolone: t centar = debljina na sredini; t 0,25 mm = debljina 0,25 mm od bočne ivice; t prosek = površina / širina. Spoljašnji Ø je za veličinu 62 (unutrašnji Ø 19,74). Izvor „API presek" znači sirov presek sa servera. „Dekodirani parametri" znači presek ponovo napravljen iz izvučenih radijusa, sa tačnošću ≤ 0,001 mm.

#### Debljina H na širini 5.0 mm

| Profil | H nominal | t centar | t 0.25 mm od ivice | t prosek (A/W) | spolj. Ø (vel. 62) | izvor |
|---|--:|--:|--:|--:|--:|---|
| P1 | 1.0 | 1.00 | 0.97 | 0.98 | 21.74 | API presek |
| P1 | 1.2 | 1.20 | 1.17 | 1.18 | 22.14 | API, dekodirani parametri |
| P1 | 1.5 | 1.50 | 1.47 | 1.48 | 22.74 | API presek |
| P1 | 1.8 | 1.80 | 1.77 | 1.78 | 23.34 | API presek |
| P1 | 2.0 | 2.00 | 1.97 | 1.98 | 23.74 | API, dekodirani parametri |
| P1 | 2.5 | 2.50 | 2.47 | 2.48 | 24.74 | API presek |
| P2 | 1.0 | 1.00 | 0.67 | 0.85 | 21.74 | API presek |
| P2 | 1.2 | 1.20 | 0.79 | 1.02 | 22.14 | API, dekodirani parametri |
| P2 | 1.5 | 1.50 | 0.98 | 1.28 | 22.74 | API presek |
| P2 | 1.8 | 1.80 | 1.16 | 1.53 | 23.34 | API presek |
| P2 | 2.0 | 2.00 | 1.29 | 1.71 | 23.74 | API, dekodirani parametri |
| P2 | 2.5 | 2.50 | 1.61 | 2.14 | 24.74 | API presek |
| P4 | 1.0 | 1.00 | 0.54 | 0.80 | 21.74 | API presek |
| P4 | 1.2 | 1.20 | 0.59 | 0.94 | 22.14 | API, dekodirani parametri |
| P4 | 1.5 | 1.50 | 0.66 | 1.15 | 22.74 | API presek |
| P4 | 1.8 | 1.80 | 0.71 | 1.36 | 23.34 | API presek |
| P4 | 2.0 | 2.00 | 0.78 | 1.51 | 23.74 | API, dekodirani parametri |
| P4 | 2.5 | 2.50 | 0.92 | 1.87 | 24.74 | API presek |
| P6 | 1.0 | 1.00 | 0.73 | 0.94 | 21.74 | API presek |
| P6 | 1.2 | 1.20 | 0.90 | 1.13 | 22.14 | API, dekodirani parametri |
| P6 | 1.5 | 1.50 | 1.20 | 1.43 | 22.74 | API presek |
| P6 | 1.8 | 1.80 | 1.50 | 1.73 | 23.34 | API presek |
| P6 | 2.0 | 2.00 | 1.70 | 1.93 | 23.74 | API, dekodirani parametri |
| P6 | 2.5 | 2.50 | 2.20 | 2.43 | 24.74 | API presek |
| P9 | 1.0 | 1.00 | 0.68 | 0.86 | 21.74 | API presek |
| P9 | 1.2 | 1.20 | 0.77 | 1.02 | 22.14 | API, dekodirani parametri |
| P9 | 1.5 | 1.50 | 0.91 | 1.27 | 22.74 | API presek |
| P9 | 1.8 | 1.80 | 1.03 | 1.51 | 23.34 | API presek |
| P9 | 2.0 | 2.00 | 1.12 | 1.68 | 23.74 | API, dekodirani parametri |
| P9 | 2.5 | 2.50 | 1.31 | 2.08 | 24.74 | API presek |
| P10 | 1.0 | 1.00 | 0.53 | 0.80 | 21.74 | API presek |
| P10 | 1.2 | 1.20 | 0.57 | 0.94 | 22.14 | API, dekodirani parametri |
| P10 | 1.5 | 1.50 | 0.64 | 1.14 | 22.74 | API presek |
| P10 | 1.8 | 1.80 | 0.70 | 1.35 | 23.34 | API presek |
| P10 | 2.0 | 2.00 | 0.75 | 1.49 | 23.74 | API, dekodirani parametri |
| P10 | 2.5 | 2.50 | 0.87 | 1.85 | 24.74 | API presek |
| P16 | 1.0 | 1.00 | 0.53 | 0.80 | 21.74 | API presek |
| P16 | 1.2 | 1.20 | 0.57 | 0.94 | 22.14 | API, dekodirani parametri |
| P16 | 1.5 | 1.50 | 0.87 | 1.23 | 22.74 | API presek |
| P16 | 1.8 | 1.80 | 1.17 | 1.53 | 23.34 | API presek |
| P16 | 2.0 | 2.00 | 1.37 | 1.73 | 23.74 | API, dekodirani parametri |
| P16 | 2.5 | 2.50 | 1.87 | 2.23 | 24.74 | API presek |
| P18 | 1.5 | 1.50 | 0.64 | 1.14 | 22.74 | API presek |
| P18 | 1.8 | 1.80 | 0.94 | 1.44 | 23.34 | API presek |
| P18 | 2.0 | 2.00 | 1.14 | 1.64 | 23.74 | API, dekodirani parametri |
| P18 | 2.5 | 2.50 | 1.64 | 2.14 | 24.74 | API presek |

#### Širina W na debljini 1.5 mm

| Profil | W | t centar | t 0.25 mm od ivice | t prosek (A/W) | izvor |
|---|--:|--:|--:|--:|---|
| P1 | 2 | 1.50 | 1.47 | 1.45 | API presek |
| P1 | 3 | 1.50 | 1.47 | 1.46 | API, dekodirani parametri |
| P1 | 4 | 1.50 | 1.47 | 1.47 | API presek |
| P1 | 5 | 1.50 | 1.47 | 1.48 | API presek |
| P1 | 6 | 1.50 | 1.47 | 1.48 | API presek |
| P1 | 8 | 1.50 | 1.47 | 1.49 | API, dekodirani parametri |
| P1 | 12 | 1.50 | 1.47 | 1.49 | API, dekodirani parametri |
| P2 | 2 | 1.50 | 1.20 | 1.30 | API presek |
| P2 | 3 | 1.50 | 1.07 | 1.28 | API, dekodirani parametri |
| P2 | 4 | 1.50 | 1.01 | 1.28 | API presek |
| P2 | 5 | 1.50 | 0.98 | 1.28 | API presek |
| P2 | 6 | 1.50 | 0.95 | 1.28 | API presek |
| P2 | 8 | 1.50 | 0.92 | 1.28 | API, dekodirani parametri |
| P2 | 12 | 1.50 | 0.89 | 1.28 | API, dekodirani parametri |
| P4 | 2 | 1.50 | 1.01 | 1.20 | API presek |
| P4 | 3 | 1.50 | 0.83 | 1.18 | API, dekodirani parametri |
| P4 | 4 | 1.50 | 0.74 | 1.17 | API presek |
| P4 | 5 | 1.50 | 0.66 | 1.15 | API presek |
| P4 | 6 | 1.50 | 0.63 | 1.15 | API presek |
| P4 | 8 | 1.50 | 0.57 | 1.15 | API, dekodirani parametri |
| P4 | 12 | 1.50 | 0.53 | 1.15 | API, dekodirani parametri |
| P6 | 2 | 1.50 | 1.20 | 1.33 | API presek |
| P6 | 3 | 1.50 | 1.20 | 1.39 | API, dekodirani parametri |
| P6 | 4 | 1.50 | 1.20 | 1.42 | API presek |
| P6 | 5 | 1.50 | 1.20 | 1.43 | API presek |
| P6 | 6 | 1.50 | 1.20 | 1.44 | API presek |
| P6 | 8 | 1.50 | 1.20 | 1.46 | API, dekodirani parametri |
| P6 | 12 | 1.50 | 1.20 | 1.47 | API, dekodirani parametri |
| P9 | 2 | 1.50 | 1.12 | 1.26 | API presek |
| P9 | 3 | 1.50 | 1.00 | 1.26 | API, dekodirani parametri |
| P9 | 4 | 1.50 | 0.94 | 1.26 | API presek |
| P9 | 5 | 1.50 | 0.91 | 1.27 | API presek |
| P9 | 6 | 1.50 | 0.89 | 1.27 | API presek |
| P9 | 8 | 1.50 | 0.86 | 1.27 | API, dekodirani parametri |
| P9 | 12 | 1.50 | 0.84 | 1.28 | API, dekodirani parametri |
| P10 | 2 | 1.50 | 0.97 | 1.18 | API presek |
| P10 | 3 | 1.50 | 0.79 | 1.16 | API, dekodirani parametri |
| P10 | 4 | 1.50 | 0.69 | 1.15 | API presek |
| P10 | 5 | 1.50 | 0.64 | 1.14 | API presek |
| P10 | 6 | 1.50 | 0.60 | 1.14 | API presek |
| P10 | 8 | 1.50 | 0.55 | 1.14 | API, dekodirani parametri |
| P10 | 12 | 1.50 | 0.51 | 1.14 | API, dekodirani parametri |
| P16 | 2 | 1.50 | 1.22 | 1.31 | API presek |
| P16 | 3 | 1.50 | 1.03 | 1.26 | API, dekodirani parametri |
| P16 | 4 | 1.50 | 0.92 | 1.24 | API presek |
| P16 | 5 | 1.50 | 0.87 | 1.23 | API presek |
| P16 | 6 | 1.50 | 0.79 | 1.21 | API presek |
| P16 | 8 | 1.50 | 0.65 | 1.17 | API, dekodirani parametri |
| P16 | 12 | 1.50 | 0.51 | 1.14 | API, dekodirani parametri |
| P18 | 2 | 1.50 | 1.18 | 1.29 | API presek |
| P18 | 3 | 1.50 | 0.92 | 1.21 | API, dekodirani parametri |
| P18 | 4 | 1.50 | 0.74 | 1.16 | API presek |
| P18 | 5 | 1.50 | 0.64 | 1.14 | API presek |
| P18 | 6 | 1.50 | 0.63 | 1.15 | API presek |
| P18 | 8 | 1.50 | 0.55 | 1.14 | API, dekodirani parametri |
| P18 | 12 | 1.50 | 0.51 | 1.14 | API, dekodirani parametri |

---

## 7. Dokazi i provera

- **Sirovi podaci** (u paketu, folder `data/`):
  - `wama_paths_5x1.5.txt`: svih 24 preseka 5 × 1,5 u tačnom obliku sa servera.
  - `wama_sweep_paths.txt`: 47 preseka na 1,0 / 1,8 / 2,5 mm i 2 / 4 / 6 mm.
  - `wama_matrix_halfprofiles.txt`: 203 dekodirana preseka (svih 24 profila, 7–11 kombinacija širine i debljine po profilu).
  - `wama_profile_table.json`: radijusi, kosine i zidovi po kombinaciji.
- **Kontrolni zbir prepisa:** svaki od 71 prepisanih preseka uz koje je sačuvana serverska težina ponovo daje gustinu 13,3000 g/cm³, što znači da u prepisu nema greške.
- **Slike:** `figures/fig1_profili_5x1.5.png` (svih 24 profila u razmeri), `fig2_definicija_debljine.png`, `fig3_H_sweep.png`, `fig4_W_sweep.png`.
- **Provera `wamaProfile.js`** prema 242 izmerena preseka. Mera je najveće odstupanje obrisa u mm; detalji su u `data/validation_js_vs_api.json`.

| Profil | pravilo | uzoraka | medijana odstupanja | max odstupanje (slučaj) |
|---|---|--:|--:|---|
| P1 | formula | 17 | 0.004 mm | 0.004 mm (12x0.8) |
| P2 | formula | 14 | 0.004 mm | 0.005 mm (4x1.5) |
| P3 | formula | 1 (+7 provera pravila) | 0.004 mm | 0.004 mm (5x1.5) |
| P4 | fit | 15 | 0.009 mm | 0.041 mm (4x1.5) |
| P5 | formula | 8 | 0.004 mm | 0.048 mm (2x2.5) |
| P6 | formula | 16 | 0.004 mm | 0.004 mm (12x0.8) |
| P7 | tabela | 8 | 0.004 mm | 0.016 mm (2x2.5) |
| P8 | tabela | 10 | 0.004 mm | 0.065 mm (12x0.8) |
| P9 | formula | 15 | 0.004 mm | 0.087 mm (12x0.8) |
| P10 | formula | 16 | 0.004 mm | 0.015 mm (2x2.5) |
| P11 | formula | 10 | 0.004 mm | 0.087 mm (12x0.8) |
| P12 | fit | 8 | 0.008 mm | 0.029 mm (8x1.5) |
| P13 | formula + tabela | 7 | 0.005 mm | 0.023 mm (3x1.5) |
| P14 | formula + tabela | 7 | 0.004 mm | 0.007 mm (3x1.5) |
| P15 | tabela | 8 | 0.004 mm | 0.058 mm (2x2.5) |
| P16 | tabela | 14 | 0.004 mm | 0.026 mm (4x1.5) |
| P17 | tabela | 8 | 0.004 mm | 0.005 mm (5x1.5) |
| P18 | tabela | 12 | 0.004 mm | 0.030 mm (4x1.5) |
| P19 | tabela | 8 | 0.004 mm | 0.005 mm (5x1.5) |
| P20 | tabela | 8 | 0.004 mm | 0.005 mm (5x1.5) |
| P21 | tabela | 8 | 0.004 mm | 0.065 mm (2x2.5) |
| P22 | tabela | 8 | 0.004 mm | 0.065 mm (2x2.5) |
| P23 | tabela | 8 | 0.004 mm | 0.058 mm (2x2.5) |
| P24 | tabela | 8 | 0.004 mm | 0.045 mm (2x2.5) |

  Tabelarni profili (P7, P8, P15–P24) kalibrisani su na istim uzorcima, pa je njihova provera uglavnom „unutar uzorka". Van uzorka su provereni P16 i P18 na 4 i 6 mm (≤ 0,03 mm) i P1, P2, P4, P6, P9, P10 na H 1,0 / 1,8 / 2,5 i W 2 / 4 / 6 mm (≤ 0,044 mm; najveća odstupanja su P9 na H 1,0 sa 0,044 mm i P4 na 4 mm sa 0,041 mm).

---

## 8. Matematička pravila

Opšte: `c = W/2`; dubina kupole s je merena preko cele širine (od vrha do mesta gde neodsečen luk seče bok); `R = (c² + s²) / (2s)`; kupola ne može biti dublja od polukruga (R ≥ ≈ 1,01·c). Server zaokružuje radijuse (0,01 mm za male, do 0,5 mm za velike R), što na obliku pravi grešku ≤ 0,005 mm.

| Profil | vrh | gornji ugao | zid | donji ugao | unutra | pravilo |
|---|---|--:|---|---|---|---|
| P1 | ravno | 0,3 | ostatak | 0,4 | ravno | formula |
| P2 | ravno | 0,3 | ostatak | 0,4 | kupola s = H/2 − 0,10 | formula |
| P3 | konkavno s = min(0,45H, H − 0,783) | r (≈ isti kao donji) | 0 | r (0,52 / 0,512 na 5 × 1,5) | kupola, isti R kao gore | formula |
| P4 | kupola s = 0,305·(H − 0,44) | 0,3 | ≈ 0 | 0,3 | kupola s = 0,695·(H − 0,44) | fit [ESTIMATED] |
| P5 | kosina 0,52 × 0,52 | – | ostatak | 0,4 | kupola s = H/2 − 0,31 | formula |
| P6 | kosina 0,52 × 0,52 | – | ostatak | 0,4 (0,3 pri H 1,0; 0,28 pri H 0,8) | ravno | formula |
| P7 | kosina po W | – | ostatak | 0,4 | kupola, tabela | tabela |
| P8 | kosina po W | – | ostatak | 0,4 (0,3 pri H 0,8) | ravno | tabela |
| P9 | kupola s = 0,42·H | 0,3 | ostatak | max(0,4, H/2 − 0,2) | ravno | formula (H ≥ 1,2) |
| P10 | kupola s = H/2 − 0,21 | 0,3 | ostatak | 0,3 | kupola s = H/2 − 0,21 | formula |
| P11 | kupola s = 0,42·H | 0,3 | ostatak | 0,4 | ravno | formula (H ≥ 1,2) |
| P12 | ravno | 0,8 | ostatak | 0,4 | kupola s ≈ H − 1,15 | fit (H ≥ 1,5) [ESTIMATED] |
| P13 | kupola s = H/2 − 0,612 | 0,3 | 0,4 fiksno | kosina ka unutra | kupola s = 0,263 | formula + tabela |
| P14 | ravno | 0,3 | H/2 − 0,25 | kosina ka unutra | kupola s = 0,263 | formula + tabela |
| P15–P24 | kupola R po W | 0,3 | ostatak | 0,4 | kupola R po W | tabela |

Tabele (iz `wamaProfile.js`, izvučeno; između merenih širina se interpolira dubina [ESTIMATED]):
- **Kosina P7/P8 (dx × dy)** po širini: 2 mm 0,34 × 0,27 · 3 mm 0,51 × 0,41 · 5 mm 0,86 × 0,45 · 8 mm 1,29 × 0,50 · 12 mm 1,47 × 0,57.
- **Unutrašnja kosina P13/P14 (dx)** po H: P13 0,46 / 0,585 / 0,63 i P14 0,447 / 0,514 / 0,565 za H 1,5 / 2,0 / 2,5. Skoro ne zavisi od W.
- **P15–P24, radijus gornje kupole** (ne zavisi od H) za W 2 / 3 / 5 / 8 / 12 mm:

| | 2 | 3 | 5 | 8 | 12 | dubina na 5 mm |
|---|--:|--:|--:|--:|--:|--:|
| P15 | 2,5 | 3,5 | 9,5 | 24 | 44 | 0,335 |
| P16 | 1,5 | 2,5 | 7 | 17,5 | 33,5 | 0,462 |
| P17 | 1,2 | 2 | 5,5 | 13,5 | 25,5 | 0,601 |
| P18 | 1,2 | 2 | 4,5 | 11,5 | 23,5 | 0,758 |
| P19 | 2 | 3 | 8 | 20 | 36 | 0,401 |
| P20 | 1,5 | 2,5 | 6 | 15 | 31 | 0,546 |
| P21 | 1,5 | 2,5 | 6 | 15,5 | 27,5 | 0,546 |
| P22 | 1,5 | 2,5 | 7 | 18 | 34 | 0,462 |
| P23 | 1,2 | 2 | 6,5 | 12,5 | 20,5 | 0,500 |
| P24 | 1,2 | 2 | 5,5 | 11,5 | 23,5 | 0,601 |

- **P15–P24, radijus unutrašnje kupole:** puna tabela po (W, H) je u `wama_profile_table.json` i `wamaProfile.js`. Pravilo: na H 1,5 zavisi od W; za druge H se dubina skalira odnosom izmerenim na 5 mm [ESTIMATED za širine ≠ 5 mm].

---

## 9. Nepoznato i procene

- **Naš kod nije analiziran** (nije bio dostupan u ovoj sesiji). Zato poređenje „naše vs. njihovo" u §10 nije izmereno; to je postupak i lista mogućih uzroka.
- **Server ima tabelu dozvoljenih kombinacija** profila, širine i visine. Uzorkovano je 242 od najviše 9504 kombinacija. Za tabelarne profile su vrednosti između merenih širina interpolirane [ESTIMATED].
- **Granice min/max H** utvrđene su za 8 profila na 3 širine. Pretpostavljeno je da je skup dozvoljenih visina neprekidan [ESTIMATED]. Raspon širina je proveren na jednoj debljini; na najtanjim debljinama može biti uži [ESTIMATED]. Za ostalih 16 profila granice nisu merene.
- **Režim malih debljina (H ≤ 1,0)** ima posebna smanjenja uglova i plićih kupola. Uzorkovan je samo delimično, i tu je najveće odstupanje rekonstrukcije (do 0,087 mm, P9/P11 na 0,8).
- **Pravilo za `optimalRatio`** nije utvrđeno; u testu je davalo konstantnih 1,3 mm.
- **P4 i P12** su fitovani, ne preneti 1:1 (do 0,04 mm odstupanja).
- **Zaokruživanje radijusa** na serveru nije rekonstruisano (efekat ≤ 0,005 mm).

---

## 10. Preporuke za implementaciju

### 10.1 Zašto naš prsten verovatno deluje deblji: moguće geometrijske greške i njihov efekat

Efekat je izračunat na Wama geometriji (P16 5 × 1,5, veličina 62). Svaka stavka je **hipoteza** dok se naš model ne izmeri (§10.2).

| # | Moguća greška kod nas | Efekat u odnosu na Wamu | Kako se prepoznaje |
|---|---|---|---|
| H1 | H se koristi kao **visina bočnog zida**, pa se kupole dodaju iznad i ispod | sredina 1,50 → **2,28 mm** (+52 %), spoljašnji Ø 22,74 → 24,30 | izmereni `max z − min z` > nominala |
| H2 | **Comfort kupola dodata ispod linije prsta** (unutrašnji vrh je unutar obima veličine) | debljina +0,32 mm; unutrašnji obim manji za **2,0 mm** (≈ 2 EU veličine) | `min r` < obim/2π |
| H3 | Ivica pravljena kao puna visina: **bez kupole na vrhu ili sa premalim zaobljenjima** | debljina 0,25 mm od ivice: **1,50** umesto **0,87 mm** (+72 %) | t 0,25 mm ≈ H |
| H4 | Zaobljenja i kosine **skalirani sa W ili H** umesto fiksnih 0,3 / 0,4 / 0,52 | na uskim i debelim prstenovima ivice izgledaju teže ili lakše nego kod Wame | uporediti radijuse na 2 mm i na 8 mm |
| H5 | **Glatke normale preko oštrih ivica** (kosina–bok) | ivica dobija široku svetlu traku i deluje masivnije (vizuelno, nije geometrija) | pogledati normale na kosini |
| H6 | **Kamera** šira od Wame (FOV 14°, 160 mm) i bliže prstenu | perspektiva uvećava bližu ivicu (vizuelno) | uporediti FOV i razdaljinu |

H1–H3 su jedini uzroci koji mogu „dodati" debljinu pri istoj nominali. H4–H6 menjaju samo utisak. Ako i naši ravni profili (bez kupole, kao P1 ili P6) deluju deblji, uzrok nije u kupolama, nego u H2, H5 ili H6.

### 10.2 Postupak merenja našeg prstena (za Claude Code, pre ikakve izmene)
1. Generisati naš prsten za profil najbliži Wama P16 (kupola) i P6 (kosina), W = 5,0, H = 1,5, veličina 62.
2. Izvući presek iz naše mreže ili direktno iz generatora profila:

```js
// Presek iz BufferGeometry burme (lokalne koordinate, centar prstena u (0,0,0), osa rotacije = `axis`).
// Uzima jedan „prsten" verteksa (onaj najbliži uglu 0) i vraća tačke u istom sistemu kao wamaProfile.js:
// x = od sredine širine, z = iznad unutrašnjeg vrha. Jedinice: pomnožiti sa `toMm` ako mreža nije u mm.
function sectionFromGeometry(geometry, axis = 'y', toMm = 1) {
  const p = geometry.attributes.position, k = { x: 0, y: 1, z: 2 }[axis], all = [];
  for (let i = 0; i < p.count; i++) {
    const v = [p.getX(i), p.getY(i), p.getZ(i)].map((c) => c * toMm);
    const u = v[(k + 1) % 3], w = v[(k + 2) % 3];
    all.push({ a: v[k], r: Math.hypot(u, w), ang: Math.atan2(w, u) });
  }
  let ang0 = all[0].ang; for (const q of all) if (Math.abs(q.ang) < Math.abs(ang0)) ang0 = q.ang;
  const ring = all.filter((q) => Math.abs(q.ang - ang0) < 1e-4);
  let aMin = Infinity, aMax = -Infinity, rMin = Infinity, rMax = -Infinity;
  for (const q of ring) { aMin = Math.min(aMin, q.a); aMax = Math.max(aMax, q.a); rMin = Math.min(rMin, q.r); rMax = Math.max(rMax, q.r); }
  const aMid = (aMin + aMax) / 2;
  let pts = ring.map((q) => [q.a - aMid, q.r - rMin]);
  pts = pts.filter((q, i) => pts.findIndex((o) => Math.hypot(o[0] - q[0], o[1] - q[1]) < 1e-6) === i); // ukloni duplikate (oštre ivice)
  const cx = 0, cz = pts.reduce((s, q) => s + q[1], 0) / pts.length;
  pts.sort((m, n) => Math.atan2(m[1] - cz, m[0] - cx) - Math.atan2(n[1] - cz, n[0] - cx));
  return { points: pts, W: aMax - aMin, H: rMax - rMin, rMin };
}
// const s = sectionFromGeometry(mesh.geometry, 'y');  console.log(s.W, s.H, s.rMin - 62 / (2 * Math.PI), sectionMetrics(s.points, s.W));
```
Ako naš generator profila već ima 2D presek pre pravljenja mreže (lathe, extrude), bolje je meriti direktno njega, jer je tačniji od mreže.
3. Izračunati: `min r` u odnosu na 62/2π = 9,8676; `max r − min r` (mora biti 1,5); t u sredini; t 0,25 mm od ivice; t prosek. Za proračun koristiti `sectionMetrics()` iz `wamaProfile.js`.
4. Uporediti sa §1.2 (Wama P16: 1,50 / 0,87 / 1,23; P6: 1,50 / 1,20 / 1,43) i popuniti tabelu:

| | min r − 9,8676 | max r − min r | t centar | t 0,25 mm | t prosek | gornji r | donji r |
|---|--:|--:|--:|--:|--:|--:|--:|
| Wama P16 | 0,000 | 1,500 | 1,50 | 0,87 | 1,23 | 0,3 | 0,4 |
| naš (kupola) | | | | | | | |
| Wama P6 | 0,000 | 1,500 | 1,50 | 1,20 | 1,43 | kosina 0,52 | 0,4 |
| naš (kosina) | | | | | | | |

### 10.3 Preporučena pravila za naš plugin (posle merenja i odobrenja)
1. **Referentna ravan:** z = 0 je linija prsta na `R = veličina/2π` (EU veličina = unutrašnji obim u mm). Spoljašnji vrh je na `R + H`. Ništa se ne dodaje ispod linije prsta.
2. **H = max z − min z** u preseku. Comfort kupola i kupola na vrhu su unutar H.
3. **Fiksna zaobljenja i kosine u mm** (0,3 / 0,4 / 0,52 / 0,8). Ravan bočni zid je ostatak. Kada zid padne na 0, smanjuje se donje zaobljenje.
4. **Dubine kupola** po pravilima iz §8. Za naše profile: preuzeti pravilo najbližeg Wama profila (§1.1).
5. **Mreža:** oštre ivice na prelazima kosina–bok i kosina–vrh (duplirani verteksi, odvojene normale). Na tangentnim prelazima glatko. 120 segmenata po obimu (Faza 1).
6. **Provera:** `sectionMetrics` našeg preseka mora se poklapati sa tabelama iz §1.2 i §6 do ±0,02 mm za isti profil, W i H.
7. Opciono, težina: `ρ · površina · 2π · R_težišta`. Za 585 žuto zlato Wama koristi ρ = 13,3 g/cm³.

`reference/wamaProfile.js` je referenca za tačke 1–4. To nije gotov modul za naš plugin, nego dokaz da su pravila tačna.

---

## Prompt za Claude Code (Faza 3, samo merenje, bez izmena)

```
Pročitaj faza3/FAZA3-geometrija.md. Ne menjaj kod.
1. Pronađi gde naš plugin pravi presek i 3D model burme (generator profila, parametri širina/debljina/veličina, comfort).
2. Za naš profil najbliži Wama P16 i za naš profil sa kosinom (najbliži P6), na 5,0 × 1,5 mm i veličini 62,
   izmeri presek po §10.2 (koristi faza3/reference/wamaProfile.js → sectionMetrics) i popuni tabelu iz §10.2.
3. Za svaku hipotezu H1–H6 iz §10.1 napiši da li važi kod nas, uz dokaz (fajl, linija, izmerena vrednost).
4. Predloži minimalne izmene po §10.3 sa listom fajlova, pa stani i čekaj moje odobrenje.
```
