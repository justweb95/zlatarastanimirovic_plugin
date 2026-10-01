# Prompt za Claude Code: Faza 4 (metali + žlebovi), mapiranje i plan

Kopiraj ceo folder `faza4/` u projekat (npr. `docs/faza4/`; `docs/faza3/` iz prethodne faze treba da ostane), pa Claude Code-u daj ovaj tekst:

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

Sadržaj paketa:
- `FAZA4-metali-i-zlebovi.md`: glavni dokument (sekcije 0–26).
- `reference/wamaMetalsGrooves.js`: metali, gustine, cenovni model, konstrukcija žlebova, podela boja, zapremine. Referenca, nije gotov modul.
- `reference/wamaProfile.js`: profil iz Faze 3 (potreban za žlebove).
- `data/`: sirovi preseci iz 3D mreže, sweep metala, opcije žlebova, matrica cena, zapremine, rezultati provere.
- `figures/`: fig1–fig4.
- `screenshots/INDEX.md`: raspored screenshotova (slike su poslate posebno).
