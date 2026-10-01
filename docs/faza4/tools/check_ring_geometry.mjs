// Faza 4 check: our assets/js/ring-geometry.js against the Wama reference
// (docs/faza4/reference/wamaMetalsGrooves.js + docs/faza3/reference/wamaProfile.js)
// and the measured numbers of FAZA4 §17/§24.  Run from the plugin root:
//   node docs/faza4/tools/check_ring_geometry.mjs
import * as G from '../../../assets/js/ring-geometry.js';
import * as R from '../reference/wamaMetalsGrooves.js';
import { wamaSection } from '../../faza3/reference/wamaProfile.js';

let fails = 0;
const ok = (cond, msg) => { console.log((cond ? '  ok   ' : '  FAIL ') + msg); if (!cond) fails++; };
const st = (o) => ({ width: 5, thickness: 1.5, size: 62, profileWama: 'P1', ...o });
const g585 = (mm3, rho = 13.3) => (mm3 / 1000) * rho;

console.log('1. full weight (no grooves), §6 / §24');
for (const [W, H, id, exp] of [[5, 1.5, 'P1', 6.5609], [8, 1.5, 'P1', 10.5537]]) {
  const v = G.ringVolume(st({ width: W, thickness: H, profileWama: id }));
  ok(Math.abs(g585(v) - exp) < 0.001, `${id} ${W}x${H}: ${g585(v).toFixed(4)} g (Wama ${exp})`);
}
ok(Math.abs(g585(G.ringVolume(st()), 10.9) - 5.3770) < 0.001, '333 density 10.9 → 5.3770 g');
ok(Math.abs(g585(G.ringVolume(st()), 14.8) - 7.3009) < 0.001, 'white-pd 14.8 → 7.3009 g');
ok(Math.abs(g585(G.ringVolume(st()), 12.2) - 6.0183) < 0.001, 'manganese 12.2 → 6.0183 g');

console.log('2. groove outlines vs reference grooveOutline (P1 5x1.5, P16 6x2, P11 5x1.8)');
const cases = [
  ['P1', 5, 1.5, 'v-groove-60', 1.0, 0.5], ['P1', 5, 1.5, 'v-groove-90', 2.5, 0.2], ['P1', 5, 1.5, 'v-groove-120', 4.0, 0.5],
  ['P1', 5, 1.5, 'u-groove', 2.6, 1.2, 0.6], ['P1', 5, 1.5, 'square-groove', 4.0, 0.5, 0.3],
  ['P1', 8, 2, 'convex-u-groove', 1.5, 1.5, 0.1], ['P1', 8, 2, 'perlage', 6.5, 1.2],
  ['P16', 6, 2, 'v-groove-90', 1.5, 0.5], ['P16', 6, 2, 'u-groove', 3.0, 0.8, 0.15], ['P16', 6, 2, 'square-groove', 4.4, 0.3, 0.5],
  ['P16', 6, 2, 'convex-u-groove', 1.4, 1.5, 0.1], ['P16', 5, 1.8, 'u-groove', 1.2, 1.0, 0.27],
  ['P11', 5, 1.8, 'square-groove', 1.3, 0.5, 0.3], ['P11', 5, 1.8, 'v-groove-60', 3.8, 0.5],
];
for (const [id, W, H, form, pos, width, depth] of cases) {
  // reference construction on OUR base surface (the profile itself was checked in Faza 3)
  const ref = R.fromSection(G.baseLoop({ width: W, thickness: H, profileWama: id }, true).map((p) => [p[0], p[1]]), W);
  const rs = R.surfaceFn(ref);
  const ro = R.grooveOutline(form, { pos, width, depth }, rs);
  const sec = G.buildSection({ width: W, thickness: H, size: 62, profileWama: id, grooves: [{ form, pos, width, depth }] }, { fine: true });
  const ours = G.zTopOf(sec.outer, false);
  // compare our grooved surface against the reference outline over the groove span
  const low = G.zLowOf(ro.points.map((p) => [p[0] - W / 2, p[1]]), false);
  let dev = 0;
  for (let k = 1; k < 200; k++) {
    const x = ro.rim[0] + ((ro.rim[1] - ro.rim[0]) * (k + 0.37)) / 200.5;
    const a = ours(x - W / 2), b = low(x - W / 2);
    if (a !== null && b !== null) dev = Math.max(dev, Math.abs(a - b));
  }
  ok(dev < 0.002, `${id} ${W}x${H} ${form} w${width}${depth ? ' d' + depth : ''} @${pos}: max dev ${dev.toFixed(5)} mm`);
}

console.log('3. removed volume vs §17 table (P1 5x1.5)');
const full = G.ringVolume(st());
for (const [form, w, d, expMm3] of [['v-groove-90', 0.2, null, 0.7122], ['v-groove-60', 0.5, null, 7.6338], ['u-groove', 1.2, 0.6, 40.2744],
  ['square-groove', 0.5, 0.3, 11.2845], ['convex-u-groove', 1.5, 0.1, 3.5369]]) {
  const v = G.ringVolume(st({ grooves: [{ form, pos: 2.5, width: w, depth: d }] }));
  ok(Math.abs(full - v - expMm3) / expMm3 < 0.01, `${form} ${w}: removed ${(full - v).toFixed(4)} mm³ (model ${expMm3})`);
}

console.log('4. band weights (straight division; price weights = no separation groove)');
const b11 = G.bandVolumes(st({ division: { id: 'vertical-1-1' }, separation: { active: false } }));
ok(b11.every((v) => Math.abs(g585(v) - 3.2805) < 0.001), `vertical-1-1: ${b11.map((v) => g585(v).toFixed(4)).join(' + ')} (Wama 3.2805 + 3.2805)`);
const b121 = G.bandVolumes(st({ width: 6, division: { id: 'vertical-1-2-1' }, separation: { active: false } }));
const exp121 = [1.9496, 4.4430 / 14.8 * 13.3, 1.9496];
ok(b121.every((v, i) => Math.abs(g585(v) - exp121[i]) < 0.002), `P1 6x1.5 vertical-1-2-1: ${b121.map((v) => g585(v).toFixed(4)).join(' / ')} (Wama 1.9496 / ${exp121[1].toFixed(4)} @13.3 / 1.9496)`);
const bw = G.bandVolumes(st({ division: { id: 'wave-1-1', pct: 30, cycles: 2 }, separation: { active: false } }));
ok(bw.every((v) => Math.abs(g585(v) - 3.2805) < 0.002), `wave-1-1 30% 2 cyc (exact ∫φ): ${bw.map((v) => g585(v).toFixed(4)).join(' + ')} (Wama straight-cut 3.2805 each)`);
const bs = G.bandVolumes(st({ division: { id: 'vertical-1-1' } }));
ok(Math.abs(full - bs[0] - bs[1] - 0.7122) < 0.01, `separation V90 0.2×0.1 removes ${(full - bs[0] - bs[1]).toFixed(4)} mm³ (≈ 0.712)`);
const bws = G.bandVolumes(st({ division: { id: 'wave-1-1', pct: 30, cycles: 2 } }));
ok(Math.abs(full - bws[0] - bws[1] - 0.71) < 0.03, `wavy separation removes ${(full - bws[0] - bws[1]).toFixed(4)} mm³`);

console.log('5. groove placement (§11, 5 mm, V90 0.2)');
const s5 = st({ grooves: [] });
const seq = [];
for (let i = 0; i < 4; i++) {
  const p = G.autoGroovePos(s5, 'v-groove-90', 0.2);
  seq.push(p);
  if (p !== null) s5.grooves.push({ form: 'v-groove-90', pos: p, width: 0.2 });
}
ok(JSON.stringify(seq) === JSON.stringify([2.5, 3.8, 1.2, null]), `auto positions ${JSON.stringify(seq)} (Wama 2.5, 3.8, 1.2, collision)`);
ok(G.placeGroove(s5, 2, 'v-groove-90', 0.2, 0.4) === 0.6, 'V 0.2 asked at 0.4 → 0.6 (Wama MoveGroove)');
ok(G.placeGroove(s5, 1, 'v-groove-90', 0.2, 2.9) === 3.2, 'groove 1 asked at 2.9 → 3.2 (Wama)');

console.log('6. depth rule (§13): P1 5x0.8 V60 0.5 (d .433) not allowed, 0.4 (d .346) allowed');
const thin = st({ thickness: 0.8 });
ok(!G.depthAllowed(thin, 'v-groove-60', 0.5, G.vDepth(60, 0.5), 2.5) && G.depthAllowed(thin, 'v-groove-60', 0.4, G.vDepth(60, 0.4), 2.5), 'V60 limits');
ok(G.depthAllowed(thin, 'square-groove', 0.3, 0.4, 2.5) && !G.depthAllowed(thin, 'square-groove', 0.3, 0.45, 2.5), 'square ≤ 0.40 at H 0.8');

console.log('7. perlage beads: count');
const pb = G.buildSection(st({ width: 8, thickness: 2, grooves: [{ form: 'perlage', pos: 6.5, width: 1.2 }] })).beads[0];
ok(pb.count === 79, `P1 8x2 perlage 1.2: ${pb.count} beads (Wama 79)`);
const pb2 = G.buildSection({ width: 6, thickness: 2, size: 62, profileWama: 'P16', grooves: [{ form: 'perlage', pos: 4.6, width: 0.9 }] }).beads[0];
ok(Math.abs(pb2.count - 104) <= 1, `P16 6x2 perlage 0.9: ${pb2.count} beads (Wama 104)`);

console.log('8. wavy separation strips: constant point count, exact V bottom on the boundary');
const sw = G.sweepSections(st({ division: { id: 'wave-1-1', pct: 50, cycles: 3 } }), 64);
const lens = new Set(sw.strips[0].map((sl) => sl.length));
let bot = 0;
sw.strips[0].forEach((sl, i) => { const phi = (2 * Math.PI * i) / 64; const xb = 2.5 - 1.25 * Math.sin(3 * phi) - 2.5; bot = Math.max(bot, Math.abs(sl[1][0] - xb) + Math.abs(sl[1][1] - 1.4)); });
ok(lens.size === 1 && bot < 1e-9, `${sw.strips[0].length} slices × ${[...lens][0]} points; bottom error ${bot.toExponential(1)}`);
console.log(fails ? `\n${fails} FAILED` : '\nall ok');
process.exit(fails ? 1 : 0);
