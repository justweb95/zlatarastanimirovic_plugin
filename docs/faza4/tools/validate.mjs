import { wamaSection } from '../reference/wamaProfile.js';
import * as G from '../reference/wamaMetalsGrooves.js';
import fs from 'fs';
const C = 62, Rin = C / (2 * Math.PI);
const prof = (id, W, H) => G.fromSection(wamaSection(id, W, H, 0.002).points, W);
const out = { grooves: [], weights: [], prices: [] };
// ---- groove outlines vs live mesh points (r -> z)
const toZ = (pts) => pts.map(([x, r]) => [x, r - Rin]);
const meshCases = [
  ['P1', 5, 1.5, 'v-groove-90', { pos: 2.5, width: 0.2 }, [[2.4,11.3676],[2.5,11.2676],[2.6,11.3676]]],
  ['P1', 5, 1.5, 'v-groove-60', { pos: 1.0, width: 0.5 }, [[0.75,11.3676],[1,10.9346],[1.25,11.3676]]],
  ['P1', 5, 1.5, 'u-groove', { pos: 2.6, width: 1.2, depth: 0.6 }, [[2,11.3676],[2,11.3576],[2.0294,11.1722],[2.1146,11.0049],[2.2473,10.8722],[2.4146,10.787],[2.6,10.7576],[2.7854,10.787],[2.9527,10.8722],[3.0854,11.0049],[3.1706,11.1722],[3.2,11.3576],[3.2,11.3676]]],
  ['P1', 5, 1.5, 'square-groove', { pos: 4.0, width: 0.5, depth: 0.3 }, [[3.65,11.3676],[3.75,11.2676],[3.75,11.0676],[4.25,11.0676],[4.25,11.2676],[4.35,11.3676]]],
  ['P1', 8, 2.0, 'convex-u-groove', { pos: 1.5, width: 1.5, depth: 0.1 }, [[0.75,11.8676],[0.75,11.7676],[1.1217,11.8424],[1.5,11.8675],[1.8783,11.8424],[2.25,11.7676],[2.25,11.8676]]],
  ['P1', 8, 2.0, 'u-groove', { pos: 3.3, width: 1.0, depth: 0.27 }, [[2.8,11.8676],[2.8,11.8576],[2.8743,11.7656],[2.9653,11.6901],[3.0693,11.6339],[3.1823,11.5993],[3.3,11.5876],[3.4177,11.5993],[3.5307,11.6339],[3.6347,11.6901],[3.7257,11.7656],[3.8,11.8576],[3.8,11.8676]]],
  ['P1', 8, 2.0, 'u-groove', { pos: 4.6, width: 0.35, depth: 0.03 }, [[4.425,11.8676],[4.425,11.8576],[4.5407,11.831],[4.6593,11.831],[4.775,11.8576],[4.775,11.8676]]],
  ['P1', 8, 2.0, 'perlage', { pos: 6.5, width: 1.2 }, [[5.85,11.8676],[5.9,11.8176],[5.9,11.7676],[7.1,11.7676],[7.1,11.8176],[7.15,11.8676]]],
  ['P16', 6, 2.0, 'v-groove-90', { pos: 1.5, width: 0.5 }, [[1.25,11.7133],[1.5,11.5012],[1.75,11.7892]]],
  ['P16', 6, 2.0, 'u-groove', { pos: 3.0, width: 0.8, depth: 0.15 }, [[2.6001,11.8596],[2.6001,11.8496],[2.6883,11.7856],[2.7864,11.7383],[2.8915,11.7094],[3,11.6996],[3.1085,11.7094],[3.2136,11.7383],[3.3117,11.7856],[3.3999,11.8496],[3.3999,11.8596]]],
  ['P16', 6, 2.0, 'square-groove', { pos: 4.4, width: 0.3, depth: 0.5 }, [[4.15,11.8013],[4.25,11.7013],[4.25,11.2305],[4.55,11.2305],[4.55,11.6305],[4.65,11.7305]]],
  ['P16', 6, 2.0, 'convex-u-groove', { pos: 1.3, width: 1.5, depth: 0.1 }, [[0.5657,11.5668],[0.5779,11.496],[0.9315,11.6329],[1.3,11.7219],[1.6771,11.7615],[2.0439,11.8218],[2.0561,11.751]]],
  ['P16', 5, 1.8, 'square-groove', { pos: 3.9, width: 0.3, depth: 0.3 }, [[3.65,11.5725],[3.75,11.4725],[3.75,11.1704],[4.05,11.1704],[4.05,11.3704],[4.15,11.4704]]],
  ['P16', 5, 1.8, 'v-groove-90', { pos: 2.5, width: 0.5 }, [[2.25,11.6631],[2.5,11.4131],[2.75,11.6631]]],
  ['P16', 5, 1.8, 'u-groove', { pos: 1.2, width: 1.0, depth: 0.27 }, [[0.7123,11.4355],[0.7123,11.4255],[0.8023,11.3489],[0.9057,11.2916],[1.0183,11.2557],[1.1357,11.2426],[1.2535,11.253],[1.3668,11.2863],[1.4714,11.3413],[1.5632,11.4158],[1.6384,11.5069],[1.6943,11.6111],[1.6943,11.6211]]],
  ['P11', 5, 1.8, 'v-groove-60', { pos: 3.8, width: 0.5 }, [[3.55,11.5437],[3.8,11.0353],[4.05,11.3929]]],
  ['P11', 5, 1.8, 'square-groove', { pos: 1.3, width: 0.5, depth: 0.3 }, [[0.95,11.3929],[1.05,11.2929],[1.05,11.0929],[1.55,11.0929],[1.55,11.4868],[1.65,11.5868]]],
];
// distance from point to polyline
const dist = (p, poly) => { let best = 1e9; for (let i = 0; i < poly.length - 1; i++) { const [ax, az] = poly[i], [bx, bz] = poly[i + 1]; const vx = bx - ax, vz = bz - az; const L2 = vx * vx + vz * vz || 1e-12; let t = ((p[0] - ax) * vx + (p[1] - az) * vz) / L2; t = Math.max(0, Math.min(1, t)); best = Math.min(best, Math.hypot(ax + t * vx - p[0], az + t * vz - p[1])); } return best; };
for (const [id, W, H, form, g, mesh] of meshCases) {
  const poly = prof(id, W, H), surf = G.surfaceFn(poly); const o = G.grooveOutline(form, g, surf, 0.002);
  const pts = toZ(mesh); const dev = pts.map(p => dist(p, o.points)); const a = G.grooveRemovedArea(o, surf);
  out.grooves.push({ id, W, H, form, g, maxDev: +Math.max(...dev).toFixed(4), meanDev: +(dev.reduce((s, v) => s + v, 0) / dev.length).toFixed(4), area_mm2: +a.area.toFixed(5), removed_g_585: +(G.revolve(a.area, a.centroidZ, C) / 1000 * 13.3).toFixed(5), outline: o.points.length < 12 ? o.points.map(p => p.map(v => +v.toFixed(4))) : undefined });
}
// ---- weights vs measured
const wcases = [
  ['P1', 5, 1.5, [], [['yellow', 585]], [6.560941993004]],
  ['P1', 5, 1.5, [], [['yellow', 333]], [5.377012610808]],
  ['P1', 5, 1.5, [], [['yellow', 375]], [5.525003783582]],
  ['P1', 5, 1.5, [], [['yellow', 750]], [7.64621059335]],
  ['P1', 5, 1.5, [], [['manganese', 585]], [6.018307692831]],
  ['P1', 5, 1.5, [], [['white-pd', 585]], [7.300897856876]],
  ['P1', 5, 1.5, [2.5], [['yellow', 585], ['white', 585]], [3.280470996502, 3.280470996502]],
  ['P1', 5, 1.5, [1.666666666667], [['yellow', 585], ['white', 585]], [2.17138, 4.38956]],
  ['P1', 5, 1.5, [3, 4], [['yellow', 585], ['white', 585], ['yellow', 585]], [3.94593, 1.33091, 1.2841]],
  ['P1', 5, 1.5, [2.5], [['yellow', 585], ['white-pd', 585]], [3.28047, 3.65045]],
  ['P1', 6, 1.5, [1.5, 4.5], [['yellow', 585], ['white-pd', 585], ['red', 585]], [1.949558836343, 4.443045106095, 1.949558836343]],
  ['P18', 6, 1.5, [], [['white', 750]], [7.122361047049]],
  ['P4', 3, 2.0, [], [['white', 750]], [5.052521284931]],
  ['P16', 6, 2.0, [], [['yellow', 585]], [9.320636923004]],
  ['P1', 8, 1.5, [], [['yellow', 585]], [10.55368]],
];
for (const [id, W, H, cuts, alloys, meas] of wcases) {
  const poly = prof(id, W, H); const bw = G.fullBandWeights(poly, W, cuts, alloys.map(([color, fineness]) => ({ color, fineness })), C);
  out.weights.push({ id, W, H, cuts, alloys: alloys.map(a => a.join('/')), model: bw.map(b => +b.weight_g.toFixed(5)), measured: meas, maxRelErr: +Math.max(...bw.map((b, i) => Math.abs(b.weight_g - meas[i]) / meas[i])).toExponential(2) });
}
// ---- prices vs measured (vk shown)
const pcases = [
  [[['yellow', 585, 6.560941993004]], 'simple', ['polished'], false, 5988],
  [[['yellow', 333, 5.377012610808]], 'simple', ['polished'], false, 3135],
  [[['yellow', 750, 7.64621059335]], 'simple', ['polished'], false, 8634],
  [[['white', 585, 6.560941993004]], 'simple', ['polished'], true, 6111],
  [[['manganese', 585, 6.018307692831]], 'simple', ['polished'], false, 5616],
  [[['white-pd', 585, 7.300897856876]], 'simple', ['polished'], false, 7561],
  [[['yellow', 585, 6.560941993004]], 'simple', ['hammered'], false, 6185],
  [[['yellow', 585, 6.560941993004]], 'simple', ['sand-matt'], false, 6025],
  [[['yellow', 585, 6.560941993004]], 'simple', ['bark-style-2'], false, 6074],
  [[['yellow', 585, 6.560941993004]], 'simple', ['hammered-matt'], false, 6172],
  [[['yellow', 585, 6.560941993004]], 'special', ['polished'], false, 6198],
  [[['yellow', 750, 7.64621059335]], 'special', ['polished'], false, 8859],
  [[['yellow', 333, 5.377012610808]], 'special', ['polished'], false, 3347],
  [[['yellow', 585, 3.280470996502], ['white', 585, 3.280470996502]], 'multi', ['polished', 'polished'], false, 6424],
  [[['yellow', 585, 3.280470996502], ['white', 585, 3.280470996502]], 'wavy', ['polished', 'polished'], false, 6892],
  [[['yellow', 750, 3.823105296675], ['white', 750, 3.823105296675]], 'multi', ['polished', 'polished'], false, 9085],
  [[['yellow', 585, 3.28047], ['white-pd', 585, 3.65045]], 'multi', ['polished', 'polished'], false, 7235],
  [[['yellow', 585, 3.280470996502], ['white', 585, 3.280470996502]], 'multi', ['hammered', 'polished'], true, 6743],
  [[['yellow', 585, 1.949558836343], ['white-pd', 585, 4.443045106095], ['red', 585, 1.949558836343]], 'multi', ['polished', 'polished', 'polished'], false, 8714],
  [[['yellow', 585, 10.55368]], 'simple', ['hammered'], false, 9829],
];
for (const [bands, cls, surfaces, rh, measured] of pcases) {
  const p = G.wamaPrice({ bands: bands.map(([color, fineness, weight_g]) => ({ color, fineness, weight_g })), cls, surfaces, rhodiumOnAnyBand: rh });
  out.prices.push({ bands: bands.map(b => b.join('/')), cls, surfaces, rh, model: p.shown, ek: +p.ek.toFixed(3), measured, diff: p.shown - measured });
}
fs.writeFileSync('data/validation_faza4.json', JSON.stringify(out, null, 1));
console.log('GROOVES'); for (const g of out.grooves) console.log(g.id, g.W + 'x' + g.H, g.form, JSON.stringify(g.g), 'maxDev', g.maxDev, 'mean', g.meanDev, 'area', g.area_mm2, 'removed585', g.removed_g_585);
console.log('WEIGHTS'); for (const w of out.weights) console.log(w.id, w.W + 'x' + w.H, w.alloys.join('+'), 'model', JSON.stringify(w.model), 'meas', JSON.stringify(w.measured), 'relErr', w.maxRelErr);
console.log('PRICES'); for (const p of out.prices) console.log(p.bands.join('+'), p.cls, p.surfaces.join(','), p.rh ? 'Rh' : '', 'model', p.model, 'meas', p.measured, 'diff', p.diff);
