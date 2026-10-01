# Prompt za Claude Code: Faza 3 (geometrija), samo merenje

Kopiraj ceo folder `faza3/` u projekat (npr. `docs/faza3/`), pa Claude Code-u daj ovaj tekst:

```
Pročitaj docs/faza3/FAZA3-geometrija.md. Ovo je tehnička referenca za geometriju profila i debljinu burme,
dobijena reverse engineeringom Wama Gold konfiguratora (source of truth). NE MENJAJ KOD u ovom koraku.

1. Pronađi gde naš plugin pravi presek i 3D model burme: generator profila, parametri širina/debljina/veličina, comfort unutrašnjost.
   Navedi fajlove i funkcije.
2. Za naš profil najbliži Wama P16 (kupola + comfort) i naš profil sa kosinom (najbliži P6), na 5,0 × 1,5 mm i veličini 62,
   izmeri presek po §10.2 (sectionFromGeometry iz dokumenta + sectionMetrics iz docs/faza3/reference/wamaProfile.js)
   i popuni tabelu iz §10.2.
3. Za svaku hipotezu H1–H6 iz §10.1 napiši da li važi kod nas, uz dokaz (fajl, linija, izmerena vrednost).
4. Napravi mapiranje naših profila na Wama P1–P24 (§1.1).
5. Predloži minimalne izmene po §10.3, sa listom fajlova i očekivanim brojevima posle izmene. Ne menjaj render/materijale
   (to je Faza 2). Zatim stani i čekaj moje odobrenje.
```

Sadržaj paketa:
- `FAZA3-geometrija.md`: glavni dokument, sekcije 0–10.
- `reference/wamaProfile.js`: referentna rekonstrukcija preseka P1–P24 (`wamaSection`, `wamaSpec`, `buildSection`, `sectionMetrics`). Služi za proveru, nije gotov modul.
- `data/`: sirovi preseci sa servera, dekodirana matrica, tabela parametara, koordinate, rezultati provere.
- `figures/`: fig1–fig4.
- `tools/`: Python alati kojima su tabele izračunate (`tables.py` čita iz `../data`).
