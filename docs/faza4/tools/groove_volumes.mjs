import { wamaSection } from '../reference/wamaProfile.js';
import * as G from '../reference/wamaMetalsGrooves.js';
const C = 62; const poly = G.fromSection(wamaSection('P1', 5, 1.5, 0.002).points, 5); const s = G.surfaceFn(poly);
const server = { 'v-groove-60': [0.01639,0.03266,0.06519,0.09747], 'v-groove-90': [0.00948,0.01892,0.03779,0.05658], 'v-groove-120': [0.00548,0.01094,0.02187,0.03277],
  'u-groove': [0.00854,0.02842,0.11324,0.25344,0.42184,0.74659,0.66591], 'convex-u-groove': [0,0] };
const rows = [];
for (const f of ['v-groove-60','v-groove-90','v-groove-120']) G.GROOVE_OPTIONS[f].widths.forEach((w, i) => { const o = G.grooveOutline(f, { pos: 2.5, width: w }, s); const a = G.grooveRemovedArea(o, s); const v = G.revolve(a.area, a.centroidZ, C); rows.push([f, w, +G.GROOVE_OPTIONS[f].depthFor(w).toFixed(5), +a.area.toFixed(5), +v.toFixed(4), +(v/1000*13.3).toFixed(5), server[f][i]]); });
G.GROOVE_OPTIONS['u-groove'].presets.forEach(([w, d], i) => { const o = G.grooveOutline('u-groove', { pos: 2.5, width: w, depth: d }, s); const a = G.grooveRemovedArea(o, s); const v = G.revolve(a.area, a.centroidZ, C); rows.push(['u-groove', w, d, +a.area.toFixed(5), +v.toFixed(4), +(v/1000*13.3).toFixed(5), server['u-groove'][i]]); });
[1.0, 1.5].forEach((w, i) => { const o = G.grooveOutline('convex-u-groove', { pos: 2.5, width: w, depth: 0.1 }, s); const a = G.grooveRemovedArea(o, s); const v = G.revolve(a.area, a.centroidZ, C); rows.push(['convex-u-groove', w, 0.1, +a.area.toFixed(5), +v.toFixed(4), +(v/1000*13.3).toFixed(5), 0]); });
for (const [w, d] of [[0.3,0.05],[0.3,0.5],[0.5,0.3],[1.0,0.5],[2.0,0.5]]) { const o = G.grooveOutline('square-groove', { pos: 2.5, width: w, depth: d }, s); const a = G.grooveRemovedArea(o, s); const v = G.revolve(a.area, a.centroidZ, C); const srv = w*d*2*Math.PI*(C/2/Math.PI+1.5-d/2)/1000*13.3; rows.push(['square-groove', w, d, +a.area.toFixed(5), +v.toFixed(4), +(v/1000*13.3).toFixed(5), +srv.toFixed(5)]); }
for (const w of G.GROOVE_OPTIONS.perlage.widths) { const o = G.grooveOutline('perlage', { pos: 2.5, width: w }, s); const a = G.grooveRemovedArea(o, s); const v = G.revolve(a.area, a.centroidZ, C); rows.push(['perlage (channel only)', w, 0.1, +a.area.toFixed(5), +v.toFixed(4), +(v/1000*13.3).toFixed(5), 0]); }
console.log('| form | width | depth | removed area mm² (model) | removed volume mm³ (model) | removed g @585 (model) | server state Δweight g |');
console.log('|---|--:|--:|--:|--:|--:|--:|');
for (const r of rows) console.log('| ' + r.join(' | ') + ' |');
