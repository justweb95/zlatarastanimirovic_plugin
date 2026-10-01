# Status — gde smo stali

**Poslednje ažuriranje: 2026-10-01 (kraj dana, Faza 4 gotova, v0.8.0).** Pročitaj ovo prvo kad nastavljamo.

## Git

| Grana | Šta je | Stanje |
|---|---|---|
| `main` | poslednje pre današnjeg rada (Round 18, v0.6.10) | netaknut |
| `faza2-lut-metal` | samo LUT izgled metala (Faza 2) | `cf90ba9` |
| `dijamant-v2` (origin) | Pavletov dijamant v2 | spojen u `faza2-lut-dijamant` |
| `faza2-lut-dijamant` | LUT metal + dijamant v2 + Faza 3 profili + cena, v0.7.0 | commit-ovana lokalno; push ručno (`git push -u origin faza2-lut-dijamant`) |
| **`faza4-metali-zlebovi`** | **Faza 4 (iz `faza2-lut-dijamant`): metali, podela boja, žlebovi, ivice, cena po klasi, dijamant ↔ žleb — v0.8.0** | **aktivna grana — commit-ovana i push-ovana na origin** |

`main` još NIJE ažuriran — kad klijent potvrdi live, spojiti → `main`.

Zip za live **v0.8.0** (iz commit-a `c4a6a82`, bez `docs/`/`CLAUDE.md`): `C:\Users\Pavle\Desktop\zs-configurator-0.8.0.zip` — Pavle ga objavljuje na live. (v0.7.0: `C:\Users\Pavle\Downloads\zs-configurator-0.7.0.zip`.)
Pravi se ovako: `git archive --format=zip --prefix=zs-configurator/ -o <out>.zip HEAD -- . ':(exclude)docs' ':(exclude)CLAUDE.md' ':(exclude).gitignore'`

## Urađeno danas (detalji u `decisions.md` #74–#79)

1. **#74 Izgled metala = LUT** (paket `faza2/`): siva cube mapa `assets/env/studio-v3/` → gradijent po metalu (`LUT_STOPS`), bez PBR/svetala/tone mappinga. Mat/Grebano → `studio-v3-blur`. Dve/Tri boje = LUT po zoni. LUT po prstenu (njen/njegov mogu biti različiti metali). DPR 2–3. Dev test `?calib=1` (konzola: LUT kriva + raspodela svetline).
2. **Dijamant v2** (`dijamant-v2`) utisnut u LUT prsten: rupe ležišta u LUT shaderu, zid ležišta = LUT materijal; centar kamena podignut na pola puta do vrha prstena (`stoneParams.lift` 0,5, klizač u `?zscdebug=1`).
3. **#75/#76 Profili po Wama Gold pravilima** (paket `docs/faza3/`): svih 12 profila preko `params.wama` (P1–P24), ≤ 0,0105 mm od reference. Debljina = unutrašnji vrh → spoljašnji vrh (comfort unutar nje). HeightAdaptation (npr. Bombirani ≥ 1,4). Debljina 0,8–2,5 / 0,1. Podrazumevano njegov 5 × 1,2 vel. 62, njena 5 × 1,0 vel. 54. Kamera FOV 14° (Wama), isti kadar.
4. **#77 Cena**: RSD/g po finoći unosi admin (Podešavanja → „Cena zlata po gramu“, `zs_settings.finoce` + `spot_prices`) — jedini izvor cene. Masa iz zapremine 3D mreže (žlebovi uključeni), `Math.ceil` po prstenu, par = zbir. UI: „Ukupno“, „Cena prvog prstena“ (Njena), „Cena drugog prstena“ (Njegova).
5. **Live nadogradnja**: `Seeder::upgrade_data()` jednom upiše `params.wama` i novi opseg debljine u postojeće redove (`zs_data_version` = 2), ne dira admin podešavanja.

## Faza 4 (decisions #78–#79, `docs/faza4/IMPLEMENTACIJA.md`)

- Nov modul `assets/js/ring-geometry.js` (profil + žlebovi + podela + zapremina + pravila), deli ga scena/cena/UI.
- Materijal: 5 Wama metala (+ manganovo, belo Pd), 24 preseta podele (ravno/talas/dijagonala/slobodno), metal + rodijum po traci, finoća po prstenu sa automatskim prebacivanjem.
- Žlebovi: 7 Wama oblika sa tačnim merama, pozicija od leve ivice (0,01), pravilo 0,5 mm (pomeri/odbij), dubina ≤ ½ zida; tabovi „Granice boja“ (razdvajajući žleb) i „Ivice“ (stepenik/perlaž); živi presek prstena sa žlebovima.
- 3D: žleb u preseku (oštar), kuglice perlaža, LUT atlas za do 5 traka, talasasta granica u shaderu.
- Cena: stvarna masa po traci × (cena/g + doplata klase) + doplate metala + rodijum + obrada + kamen + gravura → ceil.
- Testovi: `node docs/faza4/tools/check_ring_geometry.mjs` (sve ok); `check_prices_browser.mjs` (§24: 18/18 do zlota, P16 ±3 iz Faze 3); `?calib=1` LUT prolazi za 5 metala, svetlina identična v0.7.0.
- Dijamant ↔ žleb (#79): kamen nikad ne dodiruje žleb; zauzete pozicije onemogućene uz objašnjenje, nov žleb zaobilazi kamen.
- Lokalno: `zs_data_version` = 3 (nadogradnja urađena), cene su i dalje 0 → „Cena na upit“.

## Live — šta treba posle upload-a

- Admin → Dodaci → Otpremi `zs-configurator-0.7.0.zip` → „Zameni trenutni“.
- **Uneti cene** 14K / 18K u Podešavanjima (lokalno su vraćene na 0 → „Cena na upit“).
- v0.8.0: posle upload-a nadogradnja (v3) sama doda manganovo i belo Pd (uključeni), finoće 333/375 (isključene) i Wama gustine (samo tamo gde admin nije menjao). Uneti po želji: doplate klase (poseban žleb / više boja / talas) po finoći, rodijum, doplate za manganovo/Pd (Opcije → Materijal).
- Proveriti gustine za 22K/24K pre nego što se uključe (to su moje početne vrednosti).
- Isprazniti keš/CDN ako postoji.

## Otvoreno / sledeće

- [ ] Pavle: objaviti v0.8.0 na live (zip na Desktopu), proveriti nadogradnju podataka (v3) i uneti doplate po želji.
- [ ] Klijent: potvrda izgleda na live-u (metal, profili, kamera, cena, podela boja, žlebovi) → merge `faza4-metali-zlebovi` u `main`.
- [ ] **Referentna slika za odsjaj** koju je Pavle pominjao nikad nije stigla — tražiti ponovo.
- [ ] Faza 5: autoritativna cena na serveru pri upitu (ista zapremina kao frontend).
- [x] Dve/Tri boje: gustina po zoni — Faza 4 (masa po traci).
- [ ] Faza 4: klijent da potvrdi nove metale (manganovo, belo Pd) i 333/375 u ponudi; iznose doplata klase.
- [ ] Faza 4: postojeća sitnica — topbar „Sačuvaj/Podeli“ izlazi 10 px van ekrana na 390 px (bilo i pre).
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
