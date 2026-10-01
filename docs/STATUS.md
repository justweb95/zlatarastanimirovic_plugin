# Status — gde smo stali

**Poslednje ažuriranje: 2026-10-01 (kraj dana).** Pročitaj ovo prvo kad nastavljamo.

## Git

| Grana | Šta je | Stanje |
|---|---|---|
| `main` | poslednje pre današnjeg rada (Round 18, v0.6.10) | netaknut |
| `faza2-lut-metal` | samo LUT izgled metala (Faza 2) | `cf90ba9` |
| `dijamant-v2` (origin) | Pavletov dijamant v2 | spojen u `faza2-lut-dijamant` |
| **`faza2-lut-dijamant`** | **sve današnje: LUT metal + dijamant v2 + Faza 3 profili + cena, v0.7.0** | **aktivna grana, push-ovana na origin** |

`main` još NIJE ažuriran — kad klijent potvrdi live, spojiti `faza2-lut-dijamant` → `main`.

Zip za live (iz commit-a, bez `docs/`/`CLAUDE.md`): `C:\Users\Pavle\Downloads\zs-configurator-0.7.0.zip`.
Pravi se ovako: `git archive --format=zip --prefix=zs-configurator/ -o <out>.zip HEAD -- . ':(exclude)docs' ':(exclude)CLAUDE.md' ':(exclude).gitignore'`

## Urađeno danas (detalji u `decisions.md` #74–#77)

1. **#74 Izgled metala = LUT** (paket `faza2/`): siva cube mapa `assets/env/studio-v3/` → gradijent po metalu (`LUT_STOPS`), bez PBR/svetala/tone mappinga. Mat/Grebano → `studio-v3-blur`. Dve/Tri boje = LUT po zoni. LUT po prstenu (njen/njegov mogu biti različiti metali). DPR 2–3. Dev test `?calib=1` (konzola: LUT kriva + raspodela svetline).
2. **Dijamant v2** (`dijamant-v2`) utisnut u LUT prsten: rupe ležišta u LUT shaderu, zid ležišta = LUT materijal; centar kamena podignut na pola puta do vrha prstena (`stoneParams.lift` 0,5, klizač u `?zscdebug=1`).
3. **#75/#76 Profili po Wama Gold pravilima** (paket `docs/faza3/`): svih 12 profila preko `params.wama` (P1–P24), ≤ 0,0105 mm od reference. Debljina = unutrašnji vrh → spoljašnji vrh (comfort unutar nje). HeightAdaptation (npr. Bombirani ≥ 1,4). Debljina 0,8–2,5 / 0,1. Podrazumevano njegov 5 × 1,2 vel. 62, njena 5 × 1,0 vel. 54. Kamera FOV 14° (Wama), isti kadar.
4. **#77 Cena**: RSD/g po finoći unosi admin (Podešavanja → „Cena zlata po gramu“, `zs_settings.finoce` + `spot_prices`) — jedini izvor cene. Masa iz zapremine 3D mreže (žlebovi uključeni), `Math.ceil` po prstenu, par = zbir. UI: „Ukupno“, „Cena prvog prstena“ (Njena), „Cena drugog prstena“ (Njegova).
5. **Live nadogradnja**: `Seeder::upgrade_data()` jednom upiše `params.wama` i novi opseg debljine u postojeće redove (`zs_data_version` = 2), ne dira admin podešavanja.

## Live — šta treba posle upload-a

- Admin → Dodaci → Otpremi `zs-configurator-0.7.0.zip` → „Zameni trenutni“.
- **Uneti cene** 14K / 18K u Podešavanjima (lokalno su vraćene na 0 → „Cena na upit“).
- Proveriti gustine za 22K/24K pre nego što se uključe (to su moje početne vrednosti).
- Isprazniti keš/CDN ako postoji.

## Otvoreno / sledeće

- [ ] Klijent: potvrda izgleda na live-u (metal, profili, kamera, cena) → merge u `main`.
- [ ] **Referentna slika za odsjaj** koju je Pavle pominjao nikad nije stigla — tražiti ponovo.
- [ ] Faza 5: autoritativna cena na serveru pri upitu (ista zapremina kao frontend).
- [ ] Dve/Tri boje: gustina po zoni (sada glavni metal).
- [ ] 18K „deepen“ boja se ignoriše u LUT-u → sopstveni LUT po finoći (V2 boje).
- [ ] Ugašeni profili `nozasti`, `siljati-oval` nemaju Wama id (koriste stari outline ako se uključe).
- [ ] Wama min. debljina za širine > 8 mm nije merena (mi idemo do 8).
- [ ] Grebano/Čekićano normal mape (van Faze 2/3).
- [ ] Svelte/Vite migracija (Faza 2b) i dalje nije počela.

## Kako testiramo (headless)

- Playwright Chromium je na mašini (`~/.cache/ms-playwright/chromium_headless_shell-1243/...`), ali **`playwright-core` npm paket nije u projektu** — instalirati u scratch/temp folder: `npm i playwright-core@1`, pa `chromium.launch({ executablePath, args: ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'] })`.
- Konfigurator je početna stranica: `http://localhost/zlatarastanimirovic/` (`/index.php/konfigurator/` preusmerava na nju).
- Korisne kuke: `window.__zscApp` (`state`, `pushScene()`, `recalc()`, `_lastPrice`, `ringVolume(k)`), `?calib=1` → `window.zscCalib('yellow')`, `?zscdebug=1` → `__zscApp.scene.debug`.
- Referenca za proveru profila: `docs/faza3/reference/wamaProfile.js` (`wamaSection`, `sectionMetrics`) — može i `import()` iz browsera.
- Posle izmene opcija u bazi: `wp eval '\ZS\Configurator\Data\Compiler::flush_all();'`.
- Admin za testove: `paki` / `paki`.
