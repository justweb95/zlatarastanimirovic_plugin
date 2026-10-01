# Live notes Faza 4 (2026-10-01 ~18:30-19:30 CEST), container 6abd2fc176791b724e0ee716, ring left, P1 5x1.5 size 62 unless noted
## Metals
- colors: red(Czerwone złoto), white(Białe złoto), yellow(Żółte złoto), manganese(Manganowe złoto), white-pd(Białe złoto (PD)); fairtrade: no possibility returned
- fineness: yellow/white/red 333/375/585/750; manganese 585 only; white-pd 585 only
- 3D material: disks[].outerMaterial{surface,gradient}, innerMaterial{surface:'polished' always,gradient}; gradient = color id; fineness does NOT change gradient (checked 333/585/750 for yellow/white/red)
- rhodinated: possibility true only for white; sets disc.rhodinated true; 3D gradient unchanged (white); price ek +50 (ek-gold 50) -> vk +123 (6111 vs 5988)
- ruthinated: possibility null for all colors/surfaces; setter ignored (stays false)
- surfaces (11): polished 0; sand-matt, brushed-matt-crosswise/diagonal/lengthwise, strong-brushed-matt-lengthwise, diamond-matt, ice-matt +15 ek; bark-style-2 +35; hammered-matt +75; hammered +80 (ek-gold, flat, at P1 5x1.5); weight unchanged; only outerMaterial.surface changes, inner stays polished
- price: ek = weight * k(fineness) + surcharges; k: 333->237, 375->260, 585->371, 750->459 zł/g (ek); vk = 2.46*ek; result = round(vk). manganese ek-gold 50 (flat), white-pd ek-gold 50/g (365.04 = 50*7.3009)
- densities (weight / V, V = 6.560941993004/13.3 cm3): 333 10.9, 375 11.2, 585 13.3, 750 15.5 (same for yellow/white/red); manganese 585 12.2; white-pd 585 14.8
- pcm 585: yellow au .585 ag .083 cu .270 zn .062; white au .585 cu .256 ni .083 zn .075 (nickel white); red au .585 ag .010 cu .390 zn .015; manganese au .585 pd .190; white-pd only au listed; 333/375/750 only au listed
## Division (multi-color), P1 5x1.5
- 24 presets; vertical bands across width (discs) around full circumference; disc width = W*rate/sum(rates); cut = boundary offset from left edge (mm)
- separation groove auto at every boundary: v-groove-90 w0.2 d0.1 polished (active true); options depth .1/.15/.2/.25, width .2/.3/.4/.5, form v60/v90/v120/u/square (convex,perlage not selectable), surface polished; UI also has separation.color and per-boundary toggle separation.active
- wave: slice sine amplitude = pct/100 * W/2 (pct 30..70), cycles 1..6 (default 2), shiftAngle 0; diagonal = sine with 1 cycle, pct 30..70; amplitude independent of cycles
- free-N: cut limits min 0.6 from edges, min 0.5 between cuts, step 0.01
- price: discCount>=2 -> 398 zł/g (585) ; wavy/diagonal -> 427 zł/g (585); price DTO weights per band exclude separation groove (sum = full weight); state weights per band are numerical, subtract groove inconsistently
- per band DTO weight = rho * area_band * 2pi * Rc_band (verified 1mm full-height band 1.33091)
