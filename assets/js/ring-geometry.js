/*
 * ZS Configurator — ring geometry (pure math, no three.js, no DOM).
 *
 * One module for everything that defines the METAL of a ring, shared by the
 * 3D scene (what is drawn), the price (what is weighed) and the UI (what is
 * allowed), so the three can never disagree:
 *
 *   PROFILE  — Wama Gold construction rules, Faza 3 (decisions #76),
 *              docs/faza3/FAZA3-geometrija.md. Moved here from scene.module.js
 *              unchanged.
 *   GROOVES  — Faza 4 (decisions #78), docs/faza4/FAZA4-metali-i-zlebovi.md
 *              §9–§14, §23: 7 design forms (V60/V90/V120/U/convex/square/
 *              perlage), edge steps (normal/perlage) and the separation groove
 *              on every colour boundary. Absolute mm, projected onto the
 *              profile (V/square radial, U/convex rotated with the slope).
 *              Reconstruction = docs/faza4/reference/wamaMetalsGrooves.js
 *              (≤ 0.004 mm from the live Wama mesh).
 *   DIVISION — §7/§8: bands ACROSS the width, each 360° round the ring;
 *              straight cuts or a sine boundary x = cut − A·sin(n·φ).
 *   VOLUME   — per band, Pappus (A · 2π · R_centroid), grooves removed, perlage
 *              beads added (§17, our real-mass choice from §25).
 *
 * Coordinates: x across the band, CENTRED (−W/2 … +W/2, −W/2 = left edge);
 * z = height above the finger line (inner apex z = 0, outer apex z = H);
 * radius = size / 2π + z. UI positions (groove `pos`, cuts) are Wama's "mm from
 * the left edge" and are converted with x = pos − W/2.
 *
 * Loaded as an ES module by scene.module.js ('zsc/ring-geometry' in the
 * shortcode's import map) and importable from Node for the tests in
 * docs/faza4/tools/ (node --input-type=module).
 */

// ------------------------------------------------------------ profiles (Faza 3)
// Coordinates: section space x = across the band (0 = centre), z = height
// above the finger line. profilePoints() turns that into the (radius, width)
// Vector2 loop LatheGeometry wants.

// Our profile slugs map to a Wama id through params.wama (Seeder); a
// keyword shape without one falls back to this table.
export const SHAPE_WAMA = { flat: 'P6', 'd-comfort': 'P11', round: 'P10', court: 'P16' };
// Smallest thickness Wama accepts for a profile (measured, §3.4); wamaMinH()
// additionally requires the section to actually fit (side wall ≥ 0 even with
// the inner fillet shrunk to 0). The UI lifts the thickness to that value
// when such a profile/width is picked (their HeightAdaptation).
export const WAMA_MIN_H = { P12: 1.2, P13: 1.4, P16: 1.0 };

const WRs = (c, s) => (c * c + s * s) / (2 * s);
const WdomeR = (c, s) => Math.max(WRs(c, Math.max(s, 0.005)), c * 1.01);   // ≤ half circle
const WTAB = {
  slope78: { 2: [0.34, 0.27], 3: [0.51, 0.41], 5: [0.86, 0.45], 8: [1.29, 0.50], 12: [1.47, 0.57] },
  P15: { top: { 2: 2.5, 3: 3.5, 5: 9.5, 8: 24, 12: 44 }, inner: { 2: 3, 3: 3, 5: 10, 8: 16, 12: 70 }, inner25: { 12: 24 } },
  P16: { top: { 2: 1.5, 3: 2.5, 5: 7, 8: 17.5, 12: 33.5 }, inner: { 2: 4, 3: 6, 5: 10, 8: 16, 12: 34 }, inner25: { 12: 24 } },
  P17: { top: { 2: 1.2, 3: 2, 5: 5.5, 8: 13.5, 12: 25.5 }, inner: { 2: 6, 3: 6, 5: 12, 8: 18, 12: 50 }, inner25: { 12: 24 } },
  P18: { top: { 2: 1.2, 3: 2, 5: 4.5, 8: 11.5, 12: 23.5 }, inner: { 2: 6, 3: 6, 5: 10, 8: 22, 12: 60 }, inner25: { 12: 24 } },
  P19: { top: { 2: 2, 3: 3, 5: 8, 8: 20, 12: 36 }, inner: { 2: 3.5, 3: 5, 5: 9, 8: 16, 12: 32 }, inner25: { 12: 24 } },
  P20: { top: { 2: 1.5, 3: 2.5, 5: 6, 8: 15, 12: 31 }, inner: { 2: 4, 3: 5, 5: 9, 8: 16, 12: 36 }, inner25: { 12: 24 } },
  P21: { top: { 2: 1.5, 3: 2.5, 5: 6, 8: 15.5, 12: 27.5 }, inner: { 2: 4, 3: 5, 5: 9, 8: 16, 12: 42 }, inner25: { 12: 24 } },
  P22: { top: { 2: 1.5, 3: 2.5, 5: 7, 8: 18, 12: 34 }, inner: { 2: 4, 3: 4.5, 5: 8, 8: 14, 12: 33 }, inner25: { 12: 22 } },
  P23: { top: { 2: 1.2, 3: 2, 5: 6.5, 8: 12.5, 12: 20.5 }, inner: { 2: 3, 3: 3.5, 5: 5.5, 8: 19, 12: 100 }, inner25: { 12: 25 } },
  P24: { top: { 2: 1.2, 3: 2, 5: 5.5, 8: 11.5, 12: 23.5 }, inner: { 2: 3, 3: 3.5, 5: 7.5, 8: 22.5, 12: 60 }, inner25: { 12: 23 } },
  P7: { inner: { 2: 6, 3: 3, 5: 7, 8: 19, 12: 50 }, inner25: { 12: 24 }, innerAt5: { 1.2: 20, 1.5: 7, 2: 5 } },
  at5: { P15: { 1.2: 10, 1.5: 10, 2: 10 }, P16: { 1: 25, 1.2: 10, 1.5: 10, 2: 10 }, P17: { 1.2: 17, 1.5: 12, 2: 12 },
         P18: { 1.5: 10, 2: 10, 2.5: 10 }, P19: { 1.2: 9, 1.5: 9, 2: 9 }, P20: { 1.2: 14, 1.5: 9, 2: 9 }, P21: { 1.2: 14, 1.5: 9, 2: 9 },
         P22: { 1.2: 10, 1.5: 8, 2: 8 }, P23: { 1.2: 11, 1.5: 5.5, 2: 5.5 }, P24: { 1.2: 17, 1.5: 7.5, 2: 6 } },
  P13dx: { 1.5: 0.46, 2: 0.585, 2.5: 0.63 },
  P14dx: { 1.5: 0.447, 2: 0.514, 2.5: 0.565 },
};
const Wsag = (R, c) => R - Math.sqrt(Math.max(0, R * R - c * c));
function WinterpR(table, W) {                       // interpolate dome DEPTH between measured widths
  const ws = Object.keys(table).map(Number).sort((a, b) => a - b);
  const sOf = (w) => Wsag(table[w], w / 2);
  if (W <= ws[0]) return WdomeR(W / 2, sOf(ws[0]));
  if (W >= ws[ws.length - 1]) return WdomeR(W / 2, sOf(ws[ws.length - 1]));
  for (let i = 0; i < ws.length - 1; i++) if (W >= ws[i] && W <= ws[i + 1]) {
    if (W === ws[i]) return table[ws[i]];
    const t = (W - ws[i]) / (ws[i + 1] - ws[i]);
    return WdomeR(W / 2, sOf(ws[i]) * (1 - t) + sOf(ws[i + 1]) * t);
  }
  return table[ws[0]];
}
function WinterpPair(table, W) {
  const ws = Object.keys(table).map(Number).sort((a, b) => a - b);
  if (W <= ws[0]) return table[ws[0]];
  if (W >= ws[ws.length - 1]) return table[ws[ws.length - 1]];
  for (let i = 0; i < ws.length - 1; i++) if (W >= ws[i] && W <= ws[i + 1]) {
    const t = (W - ws[i]) / (ws[i + 1] - ws[i]);
    return table[ws[i]].map((v, k) => v * (1 - t) + table[ws[i + 1]][k] * t);
  }
  return table[ws[0]];
}
function WinnerR(t, at5, W, H) {                     // inner dome: depth at (W, 1.5) scaled by the H ratio measured at W 5
  if (H >= 2.4 && W >= 11.5 && t.inner25) return t.inner25[12];
  const c = W / 2;
  let s = Wsag(WinterpR(t.inner, W), c);
  if (at5) {
    const hs = Object.keys(at5).map(Number).sort((a, b) => a - b);
    const s5 = (h) => Wsag(at5[h], 2.5);
    const ref = at5[1.5] ? s5(1.5) : s5(hs[0]);
    let k = 1;
    if (H <= hs[0]) k = s5(hs[0]) / ref;
    else if (H >= hs[hs.length - 1]) k = s5(hs[hs.length - 1]) / ref;
    else for (let i = 0; i < hs.length - 1; i++) if (H >= hs[i] && H <= hs[i + 1]) {
      const u = (H - hs[i]) / (hs[i + 1] - hs[i]);
      k = (s5(hs[i]) * (1 - u) + s5(hs[i + 1]) * u) / ref;
    }
    s *= k;
  }
  return WdomeR(c, s);
}
const WnearestKey = (obj, v) => Object.keys(obj).map(Number).reduce((a, b) => (Math.abs(b - v) < Math.abs(a - v) ? b : a));

// Construction spec per Wama id (§8). Ids we don't use (P3 concave) fall
// back to P1.
export function wamaSpec(id, W, H) {
  const c = W / 2;
  switch (id) {
    case 'P1':  return { top: { type: 'flat' }, rt: 0.3, inner: { type: 'flat' }, ri: 0.4 };
    case 'P2':  return { top: { type: 'flat' }, rt: 0.3, inner: { type: 'dome', R: WdomeR(c, H / 2 - 0.10) }, ri: 0.4 };
    case 'P4':  return { top: { type: 'dome', R: WdomeR(c, 0.305 * (H - 0.44)) }, rt: 0.3, inner: { type: 'dome', R: WdomeR(c, 0.695 * (H - 0.44)) }, ri: 0.3 };
    case 'P5':  return { top: { type: 'chamfer', dx: 0.52, dy: 0.52 }, inner: { type: 'dome', R: WdomeR(c, H / 2 - 0.31) }, ri: 0.4 };
    case 'P6':  return { top: { type: 'chamfer', dx: 0.52, dy: 0.52 }, inner: { type: 'flat' }, ri: H >= 1.2 ? 0.4 : (H >= 1.0 ? 0.3 : 0.28) };
    case 'P7': { const [dx, dy] = WinterpPair(WTAB.slope78, W);
      return { top: { type: 'chamfer', dx, dy }, inner: { type: 'dome', R: WinnerR(WTAB.P7, WTAB.P7.innerAt5, W, H) }, ri: 0.4 }; }
    case 'P8': { const [dx, dy] = WinterpPair(WTAB.slope78, W);
      return { top: { type: 'chamfer', dx, dy }, inner: { type: 'flat' }, ri: H >= 1.0 ? 0.4 : 0.3 }; }
    case 'P9':  return { top: { type: 'dome', R: WdomeR(c, 0.42 * H) }, rt: 0.3, inner: { type: 'flat' }, ri: Math.min(c, Math.max(0.4, H / 2 - 0.2)) };
    case 'P10': return { top: { type: 'dome', R: WdomeR(c, H / 2 - 0.21) }, rt: 0.3, inner: { type: 'dome', R: WdomeR(c, H / 2 - 0.21) }, ri: 0.3 };
    case 'P11': return { top: { type: 'dome', R: WdomeR(c, 0.42 * H) }, rt: 0.3, inner: { type: 'flat' }, ri: 0.4 };
    case 'P12': return { top: { type: 'flat' }, rt: 0.8, inner: { type: 'dome', R: H >= 1.5 ? WdomeR(c, H - 1.15) : 18 * (W / 5) }, ri: 0.4 };
    case 'P13': return { top: { type: 'dome', R: WdomeR(c, H / 2 - 0.612) }, rt: 0.3,
      inner: { type: 'slope', wall: 0.4, dx: WTAB.P13dx[WnearestKey(WTAB.P13dx, H)], R: WRs(c, 0.263) } };
    case 'P14': return { top: { type: 'flat' }, rt: 0.3,
      inner: { type: 'slope', wall: H / 2 - 0.25, dx: WTAB.P14dx[WnearestKey(WTAB.P14dx, H)], R: WRs(c, 0.263) } };
    default: {
      const t = WTAB[id];
      if (!t) return wamaSpec('P1', W, H);
      return { top: { type: 'dome', R: WinterpR(t.top, W) }, rt: 0.3, inner: { type: 'dome', R: WinnerR(t, WTAB.at5[id], W, H) }, ri: 0.4 };
    }
  }
}

// Arc sampling: chord error ≤ 0.007 mm (so a section measured 0.25 mm from
// the side, across two fillets, stays within ±0.02 of Wama — FAZA3 §10.3.6)
// and ≤ 30° per step; domes ≤ 4° per step so the per-vertex reflection stays
// a smooth sweep. Every step stays under HARD_EDGE_DEG, so arcs are never
// mistaken for corners. `tol` = chord error; the volume/price path asks for a
// fine 0.00002 mm (a 0.007 mm chord loses ~0.1 % of P1's area, Faza 4 check;
// 0.00002 leaves < 0.001 %).
const CHORD_DRAW = 0.007, CHORD_FINE = 0.00002;
function arcSteps(r, sweep, tol = CHORD_DRAW) {
  const chord = 2 * Math.acos(Math.max(-1, 1 - tol / r));
  const max = Math.min(Math.PI / 6, chord, r > 1.2 && tol >= CHORD_DRAW ? (4 * Math.PI) / 180 : Math.PI);
  return Math.max(1, Math.ceil(Math.abs(sweep) / max));
}

// Half section (right side), internal y DOWN with y = 0 at mid-H; returns
// [{x, y, hard}], outer apex → inner apex.
export function wamaHalf(W, H, spec, tol = CHORD_DRAW) {
  const c = W / 2, PI = Math.PI;
  const out = [];
  out.fits = true;
  const pt = (x, y, hard) => out.push({ x, y, hard: !!hard });
  const arc = (cx, cy, r, a0, a1) => {             // shortest sweep, start included, end excluded
    let da = a1 - a0; while (da > PI) da -= 2 * PI; while (da < -PI) da += 2 * PI;
    const n = arcSteps(r, da, tol);
    for (let k = 0; k < n; k++) { const a = a0 + (da * k) / n; pt(cx + r * Math.cos(a), cy + r * Math.sin(a)); }
  };
  const ang = (x, y, cx, cy) => Math.atan2(y - cy, x - cx);

  let ytSide;
  const T = spec.top, rt = spec.rt ?? 0.3;
  if (T.type === 'flat') {
    const yt = -H / 2; pt(0, yt); arc(c - rt, yt + rt, rt, -PI / 2, 0); ytSide = yt + rt;
  } else if (T.type === 'dome') {
    const R = T.R, yc = -H / 2 + R, d = R - rt, fx = c - rt, fy = yc - Math.sqrt(Math.max(0, d * d - fx * fx));
    const tx = (fx * R) / d, ty = yc + ((fy - yc) * R) / d;
    arc(0, yc, R, -PI / 2, ang(tx, ty, 0, yc)); arc(fx, fy, rt, ang(tx, ty, fx, fy), 0); ytSide = fy;
  } else {                                          // chamfer: both of its ends are sharp
    const yt = -H / 2; pt(0, yt); pt(c - T.dx, yt, true); ytSide = yt + T.dy; pt(c, ytSide, true);
  }
  const startSide = () => { if (T.type !== 'chamfer') pt(c, ytSide); };

  const I = spec.inner;
  let ri = spec.ri ?? 0.4;
  if (I.type === 'slope') {
    const ys = ytSide + I.wall, R = I.R, yc = H / 2 - R, xe = c - I.dx, ye = yc + Math.sqrt(Math.max(0, R * R - xe * xe));
    startSide(); pt(c, ys, true); pt(xe, ye, true); arc(0, yc, R, ang(xe, ye, 0, yc), PI / 2);
  } else {
    const sideY = (r) => {
      if (I.type === 'flat') return H / 2 - r;
      const R = I.R, yc = H / 2 - R, d = R - r, fx = c - r; return yc + Math.sqrt(Math.max(0, d * d - fx * fx));
    };
    if (sideY(0) < ytSide - 1e-9) out.fits = false;  // does not fit at this H (see wamaMinH)
    if (sideY(ri) < ytSide) {                       // no room → shrink the inner fillet until the wall is 0
      let lo = 0, hi = ri; for (let k = 0; k < 60; k++) { const m = (lo + hi) / 2; if (sideY(m) < ytSide) hi = m; else lo = m; } ri = lo;
    }
    const ybSide = sideY(ri);
    if (ybSide - ytSide > 1e-6) startSide();       // straight wall (skipped when it has zero length)
    else if (T.type === 'chamfer') { /* chamfer foot already emitted */ }
    if (I.type === 'flat') { arc(c - ri, H / 2 - ri, ri, 0, PI / 2); pt(c - ri, H / 2); }
    else {
      const R = I.R, yc = H / 2 - R, d = R - ri, fx = c - ri, fy = ybSide, tx = (fx * R) / d, ty = yc + ((fy - yc) * R) / d;
      arc(fx, fy, ri, 0, ang(tx, ty, fx, fy)); arc(0, yc, R, ang(tx, ty, 0, yc), PI / 2);
    }
  }
  pt(0, H / 2);                                     // inner apex
  return out;
}

// Thinnest buildable thickness (0.1 mm steps, 0.8–2.5) for a profile at a width.
export function wamaMinH(id, W) {
  for (let k = 8; k <= 25; k++) {
    const H = k / 10;
    if (H >= (WAMA_MIN_H[id] || 0) - 1e-9 && wamaHalf(W, H, wamaSpec(id, W, H)).fits) return H;
  }
  return 2.5;
}

// Closed section loop [[x, z, hard], …] (z above the finger line), mirrored
// from the right half; exactly collinear points on straight runs are dropped
// (a flat top keeps only its 2 corner points, as in the reference mesh).
export function wamaSectionLoop(id, W, H, fine = false) {
  const right = wamaHalf(W, H, wamaSpec(id, W, H), fine ? CHORD_FINE : CHORD_DRAW);
  const left = right.slice(1, -1).reverse().map((p) => ({ x: -p.x, y: p.y, hard: p.hard }));
  const all = right.concat(left).map((p) => [p.x, H / 2 - p.y, p.hard]);
  const n = all.length;
  return all.filter((p, i) => {
    if (p[2]) return true;
    const a = all[(i - 1 + n) % n], b = all[(i + 1) % n];
    const cross = (p[0] - a[0]) * (b[1] - p[1]) - (p[1] - a[1]) * (b[0] - p[0]);
    const dot = (p[0] - a[0]) * (b[0] - p[0]) + (p[1] - a[1]) * (b[1] - p[1]);
    return !(Math.abs(cross) < 1e-12 && dot > 0);
  });
}

// Section area + centroid height (z above the finger line) of a profile —
// for the weight formula (ρ · A · 2π · R_centroid).
export function sectionStats(loop) {
  let A = 0, Cz = 0;
  for (let i = 0; i < loop.length; i++) {
    const [x1, z1] = loop[i], [x2, z2] = loop[(i + 1) % loop.length];
    const cr = x1 * z2 - x2 * z1;
    A += cr; Cz += (z1 + z2) * cr;
  }
  return { area: Math.abs(A) / 2, centroidZ: A ? Cz / (3 * A) : 0 };
}

// Legacy normalised outline (param profile without a Wama id): nx −1…1 width,
// ny −1…1 thickness with ny = −1 the OUTER side → [[x, z, hard]] loop; corners
// sharper than 38° are flagged hard (same rule the scene used before).
const HARD_EDGE_DEG = 38;
export function legacyLoop(outline, W, H) {
  const L = outline.map(([nx, ny]) => [nx * (W / 2), ((1 - ny) / 2) * H, false]);
  const n = L.length, cosLim = Math.cos((HARD_EDGE_DEG * Math.PI) / 180);
  for (let i = 0; i < n; i++) {
    const a = L[(i - 1 + n) % n], p = L[i], b = L[(i + 1) % n];
    const ux = p[0] - a[0], uz = p[1] - a[1], vx = b[0] - p[0], vz = b[1] - p[1];
    const lu = Math.hypot(ux, uz), lv = Math.hypot(vx, vz);
    if (lu > 1e-7 && lv > 1e-7 && (ux * vx + uz * vz) / (lu * lv) < cosLim) p[2] = true;
  }
  return L;
}

// The base (ungrooved) section of a ring state: [[x, z, hard], …], closed
// implicitly (no repeated first point).
export function baseLoop(st, fine = false) {
  const W = st.width || 4, H = st.thickness || 1.4;
  const id = st.profileWama || SHAPE_WAMA[st.profileShape];
  if (id) return wamaSectionLoop(id, W, H, fine);
  if (Array.isArray(st.profileOutline) && st.profileOutline.length > 2) return legacyLoop(st.profileOutline, W, H);
  return wamaSectionLoop('P6', W, H, fine);
}

// ------------------------------------------------------------ outer surface
//
// The outer surface is the upper envelope of the section: one polyline from
// the top of the left wall (x = −W/2) to the top of the right wall (x = +W/2).
// Grooves and edge steps only ever replace a piece of it; the inner surface
// and the walls below it never change (§10, §25).

function crossings(poly, x, closed) {
  const out = [];
  const n = poly.length, m = closed ? n : n - 1;
  for (let i = 0; i < m; i++) {
    const a = poly[i], b = poly[(i + 1) % n];
    if ((a[0] - x) * (b[0] - x) > 0) continue;
    if (Math.abs(b[0] - a[0]) < 1e-12) { out.push(a[1], b[1]); continue; }
    out.push(a[1] + ((b[1] - a[1]) * (x - a[0])) / (b[0] - a[0]));
  }
  return out;
}
// highest / lowest z of a polyline (or closed loop) at x; null outside
export function zTopOf(poly, closed) {
  return (x) => { const c = crossings(poly, x, closed); return c.length ? Math.max(...c) : null; };
}
export function zLowOf(poly, closed) {
  return (x) => { const c = crossings(poly, x, closed); return c.length ? Math.min(...c) : null; };
}

// Splits a section loop into { outer: left → right, rest: right wall → inner →
// left wall } with loop === outer.concat(rest) (as a cycle).
export function splitLoop(loop) {
  const n = loop.length;
  const top = zTopOf(loop, true);
  const on = loop.map((p) => p[1] >= top(p[0]) - 1e-7);
  // longest cyclic run of envelope points
  let bestS = 0, bestL = 0;
  for (let s = 0; s < n; s++) {
    if (!on[s] || on[(s - 1 + n) % n]) continue;
    let l = 0; while (l < n && on[(s + l) % n]) l++;
    if (l > bestL) { bestL = l; bestS = s; }
  }
  if (bestL === 0 || bestL === n) { // degenerate: everything (or nothing) is "top"
    const xs = loop.map((p) => p[0]);
    const iL = xs.indexOf(Math.min(...xs));
    const rot = loop.slice(iL).concat(loop.slice(0, iL));
    return { outer: rot.slice(0), rest: [] };
  }
  let run = []; for (let k = 0; k < bestL; k++) run.push(loop[(bestS + k) % n]);
  let rest = []; for (let k = bestL; k < n; k++) rest.push(loop[(bestS + k) % n]);
  if (run[0][0] > run[run.length - 1][0]) { run = run.reverse(); rest = rest.reverse(); }
  return { outer: run.map((p) => p.slice()), rest: rest.map((p) => p.slice()) };
}

// ------------------------------------------------------------ groove catalogue
//
// §9/§23 (VERIFIED). Labels are ours (Serbian UI). Widths/depths in mm.
export const GROOVE_FORMS = {
  'v-groove-60':  { type: 'v', angle: 60,  label: 'V-žleb 60°',  widths: [0.2, 0.3, 0.4, 0.5] },
  'v-groove-90':  { type: 'v', angle: 90,  label: 'V-žleb 90°',  widths: [0.2, 0.3, 0.4, 0.5] },
  'v-groove-120': { type: 'v', angle: 120, label: 'V-žleb 120°', widths: [0.2, 0.3, 0.4, 0.5] },
  'u-groove':     { type: 'u', label: 'U-žleb', presets: [[0.35, 0.03], [0.5, 0.06], [0.8, 0.15], [1.0, 0.27], [1.5, 0.3], [2.0, 0.4], [1.2, 0.6]] },
  'convex-u-groove': { type: 'bump', label: 'Ispupčeni', widths: [1.0, 1.5], depths: [0.1] },
  'square-groove': { type: 'rect', label: 'Kvadratni', widths: [0.3, 0.5, 0.8, 1.0, 1.5, 2.0],
    depths: [0.05, 0.1, 0.15, 0.2, 0.25, 0.3, 0.35, 0.4, 0.45, 0.5], chamfer: 0.1 },
  'perlage':      { type: 'perlage', label: 'Perlaž (kuglice)', widths: [0.35, 0.5, 0.75, 0.9, 1.2],
    channelDepth: 0.1, channelChamfer: 0.05, beadRatio: 7 / 9 },
};
export const GROOVE_ORDER = ['v-groove-60', 'v-groove-90', 'v-groove-120', 'u-groove', 'convex-u-groove', 'square-groove', 'perlage'];
// Default width/depth when a form is first picked (Wama defaults: smallest).
export function grooveDefaults(form) {
  const o = GROOVE_FORMS[form];
  if (o.type === 'v') return { width: o.widths[0], depth: vDepth(o.angle, o.widths[0]) };
  if (o.type === 'u') return { width: 1.0, depth: 0.27 };
  if (o.type === 'bump') return { width: 1.0, depth: 0.1 };
  if (o.type === 'rect') return { width: 0.5, depth: 0.2 };
  return { width: 0.5, depth: o.channelDepth };
}
export const vDepth = (angle, w) => (w / 2) / Math.tan(((angle / 2) * Math.PI) / 180);

// Grooves that move the price class to "special" (§22 price matrix, VERIFIED);
// V90, V120 and convex are free.
export const SPECIAL_GROOVES = ['v-groove-60', 'u-groove', 'square-groove', 'perlage'];

// Edge step (tab "Ivice", Wama "Krawędź") — §9.
export const EDGE_FORMS = {
  none: { label: 'Bez' },
  normal: { label: 'Stepenik', widths: [0.3, 0.5, 0.8, 1.0, 1.5, 2.0], depths: [0.05, 0.1, 0.15, 0.2, 0.25, 0.3, 0.35, 0.4, 0.45, 0.5] },
  perlage: { label: 'Perlaž', widths: [0.325, 0.445, 0.645, 0.8], beads: [0.3, 0.39, 0.54, 0.7], depth: 0.1, chamfer: 0.05 },
};

// Separation groove on every colour boundary (§8): V90 0.2 × 0.1 by default.
export const SEPARATION_FORMS = ['v-groove-60', 'v-groove-90', 'v-groove-120', 'u-groove', 'square-groove'];
export const SEPARATION_WIDTHS = [0.2, 0.3, 0.4, 0.5];
export const SEPARATION_DEPTHS = [0.1, 0.15, 0.2, 0.25];
export const SEPARATION_DEFAULT = { active: true, form: 'v-groove-90', width: 0.2, depth: 0.1 };
export function separationDepth(sep) {
  const o = GROOVE_FORMS[sep.form];
  return o && o.type === 'v' ? vDepth(o.angle, sep.width) : sep.depth;
}

// Half-extent of a groove's opening on the surface (centre → rim), flat-top
// approximation (U/convex rotate on slopes and get slightly narrower).
export function grooveRimHalf(form, width) {
  const o = GROOVE_FORMS[form];
  if (!o) return width / 2;
  if (o.type === 'rect') return width / 2 + o.chamfer;
  if (o.type === 'perlage') return width / 2 + o.channelChamfer;
  return width / 2;
}

// ------------------------------------------------------------ groove outline
//
// One groove → the outline that replaces the outer surface between its rims,
// left → right, [[x, z, hard], …] (§10; port of grooveOutline() in
// docs/faza4/reference/wamaMetalsGrooves.js, x centred). zAt = surface z(x).
export function grooveOutline(form, { x: pos, width, depth }, zAt, step = 0.01) {
  const o = GROOVE_FORMS[form];
  if (!o) throw new Error('unknown groove form ' + form);
  if (o.type === 'v') {
    const d = depth ?? vDepth(o.angle, width);
    const xl = pos - width / 2, xr = pos + width / 2, zl = zAt(xl), zr = zAt(xr);
    return { points: [[xl, zl, true], [pos, (zl + zr) / 2 - d, true], [xr, zr, true]], rim: [xl, xr] };
  }
  if (o.type === 'rect' || o.type === 'perlage') {
    const c = o.type === 'rect' ? o.chamfer : o.channelChamfer;
    const d = o.type === 'rect' ? depth : o.channelDepth;
    const xl = pos - width / 2, xr = pos + width / 2;
    const zol = zAt(xl - c), zor = zAt(xr + c), zf = Math.min(zol, zor) - d;
    return {
      points: [[xl - c, zol, true], [xl, zol - c, true], [xl, zf, true], [xr, zf, true], [xr, zor - c, true], [xr + c, zor, true]],
      rim: [xl - c, xr + c], floorZ: zf,
    };
  }
  // U and convex rotate with the local slope (§10)
  const h = 1e-4, th = Math.atan((zAt(pos + h) - zAt(pos - h)) / (2 * h));
  const pts = [];
  if (o.type === 'u') {
    const xl = pos - (width / 2) * Math.cos(th), xr = pos + (width / 2) * Math.cos(th);
    const p1 = [xl, zAt(xl)], p2 = [xr, zAt(xr)];
    const L = Math.hypot(p2[0] - p1[0], p2[1] - p1[1]);
    const t = [(p2[0] - p1[0]) / L, (p2[1] - p1[1]) / L], n = [t[1], -t[0]];
    const m = [(p1[0] + p2[0]) / 2, (p1[1] + p2[1]) / 2];
    const s0 = 0.01, c = L / 2, d = depth, R = (c * c + d * d) / (2 * d);
    pts.push([p1[0], p1[1], true], [p1[0], p1[1] - s0, true]);
    const N = Math.max(10, Math.ceil(width / step));   // from the nominal width → same count on any slope
    for (let k = 1; k < N; k++) {
      const u = -c + (2 * c * k) / N, v = d - (R - Math.sqrt(Math.max(0, R * R - u * u)));
      pts.push([m[0] + t[0] * u + n[0] * (v + s0), m[1] + t[1] * u + n[1] * (v + s0), false]);
    }
    pts.push([p2[0], p2[1] - s0, true], [p2[0], p2[1], true]);
    return { points: pts, rim: [xl, xr] };
  }
  // convex: arc of sagitta hgt whose apex touches the surface at pos; walls
  // along the normal from the surface down to the chord ends
  const hgt = depth ?? 0.1, c = width / 2, R = (c * c + hgt * hgt) / (2 * hgt);
  const tt = [Math.cos(th), Math.sin(th)], nn = [Math.sin(th), -Math.cos(th)];
  const A = [pos, zAt(pos)], M = [A[0] + nn[0] * hgt, A[1] + nn[1] * hgt];
  const E1 = [M[0] - tt[0] * c, M[1] - tt[1] * c], E2 = [M[0] + tt[0] * c, M[1] + tt[1] * c];
  const toSurface = (E) => {
    let s = 0;
    for (let it = 0; it < 40; it++) { const P = [E[0] - nn[0] * s, E[1] - nn[1] * s]; const f = P[1] - zAt(P[0]); s -= f / (-nn[1] - 1e-9); }
    return [E[0] - nn[0] * s, E[1] - nn[1] * s];
  };
  const r1 = toSurface(E1), r2 = toSurface(E2);
  pts.push([r1[0], r1[1], true], [E1[0], E1[1], true]);
  const N = Math.max(10, Math.ceil(width / step));
  for (let k = 1; k < N; k++) {
    const u = -c + (2 * c * k) / N, v = R - Math.sqrt(Math.max(0, R * R - u * u));
    pts.push([M[0] + tt[0] * u - nn[0] * (hgt - v), M[1] + tt[1] * u - nn[1] * (hgt - v), false]);
  }
  pts.push([E2[0], E2[1], true], [r2[0], r2[1], true]);
  return { points: pts, rim: [r1[0], r2[0]] };
}

// Replace poly (left → right) between the outline's rims with the outline.
function spliceOutline(poly, outline) {
  const [xl, xr] = outline.rim, e = 1e-9;
  const out = [];
  let done = false;
  for (const p of poly) {
    if (p[0] > xl + e && p[0] < xr - e) continue;
    if (!done && p[0] >= xr - e) { out.push(...outline.points.map((q) => q.slice())); done = true; }
    out.push(p);
  }
  if (!done) out.push(...outline.points.map((q) => q.slice()));
  return out;
}

// Edge step on the left side of poly (mirror for the right). Floor at
// z(x1) − depth from the ring edge to x1 = edge + width; the floor runs out
// into the corner fillet/chamfer where it meets it (§10 "Ivica normal",
// mesh batch 3). Perlage edge: 0.05 chamfer at the inner end, depth 0.1.
function edgeStepLeft(poly, width, depth, chamfer) {
  const x0 = poly[0][0], x1 = x0 + width;
  const top = zTopOf(poly, false);
  const zs = top(x1 + chamfer), floor = zs - depth;
  // first crossing of the floor level walking left from x1
  let xc = x0, cut = 0;
  for (let i = poly.length - 1; i > 0; i--) {
    const a = poly[i - 1], b = poly[i];
    if (a[0] >= x1) continue;
    if (a[1] <= floor && (b[1] > floor || b[0] >= x1)) {
      xc = Math.abs(b[1] - a[1]) < 1e-12 ? a[0] : a[0] + ((b[0] - a[0]) * (floor - a[1])) / (b[1] - a[1]);
      xc = Math.min(xc, x1); cut = i; break;
    }
  }
  const out = [];
  if (cut > 0) { for (let i = 0; i < cut; i++) out.push(poly[i]); out.push([xc, floor, true]); }
  else out.push([x0, floor, true]);
  out.push([x1, floor, true]);
  if (chamfer > 0) out.push([x1, zs - chamfer, true], [x1 + chamfer, zs, true]);
  else out.push([x1, top(x1), true]);
  for (const p of poly) if (p[0] > x1 + chamfer + 1e-9) out.push(p);
  return out;
}
const mirrorPoly = (poly) => poly.slice().reverse().map((p) => [-p[0], p[1], p[2]]);

// Perlage beads (§10): ellipsoids, Ø = 7/9·w across and round the ring, radial
// semi-axis 0.30·Ø/2, bottom just under the channel floor (live mesh: Ø 0.933
// spans r 11.752–12.033 over a floor at 11.768, top 0.165 above the surface).
// count = floor(2π·R_floor / Ø) — reproduces 104 (Ø 0.70, P16 6×2) and 79
// (Ø 0.933, P1 8×2).
export function beadRow(xc, d, floorZ, innerR) {
  const a = d / 2, b = 0.3 * a;
  const centreZ = floorZ - 0.017 * (d / 0.933) + b;
  const rFloor = innerR + floorZ;
  const count = Math.max(3, Math.floor((2 * Math.PI * rFloor) / d));
  return { x: xc, d, a, b, centreZ, count, volume: count * (4 / 3) * Math.PI * a * a * b };
}

// ------------------------------------------------------------ build the section
//
// st: { width, thickness, size, profileWama/profileShape/profileOutline,
//       grooves: [{ form, pos (mm from left), width, depth }],
//       edges: { left: { form, width, depth }, right: {…} },
//       separations: [{ form, width, depth, pos }] (straight cuts only) }
// → { loop, outer, rest, beads, baseOuter }
export function buildSection(st, opt = {}) {
  const W = st.width || 4;
  const innerR = (st.size || 54) / (2 * Math.PI);
  const base = splitLoop(baseLoop(st, !!opt.fine));
  let outer = base.outer.map((p) => p.slice());
  const beads = [];
  const edges = st.edges || {};
  // edges first (they reshape the corners the grooves must stay clear of)
  const L = edges.left, R = edges.right;
  if (L && L.form && L.form !== 'none') {
    const e = EDGE_FORMS[L.form];
    outer = edgeStepLeft(outer, L.width, L.form === 'perlage' ? e.depth : L.depth, L.form === 'perlage' ? e.chamfer : 0);
  }
  if (R && R.form && R.form !== 'none') {
    const e = EDGE_FORMS[R.form];
    outer = mirrorPoly(edgeStepLeft(mirrorPoly(outer), R.width, R.form === 'perlage' ? e.depth : R.depth, R.form === 'perlage' ? e.chamfer : 0));
  }
  const surf0 = zTopOf(outer, false);       // surface with edge steps, before grooves
  for (const [side, E] of [['left', L], ['right', R]]) {
    if (!E || E.form !== 'perlage') continue;
    const i = EDGE_FORMS.perlage.widths.indexOf(E.width);
    const d = EDGE_FORMS.perlage.beads[i >= 0 ? i : 1];
    const xc = side === 'left' ? -W / 2 + E.width / 2 : W / 2 - E.width / 2;
    beads.push({ ...beadRow(xc, d, surf0(xc), innerR), kind: 'edge', side });
  }
  const cuts = [];
  for (const g of st.grooves || []) cuts.push({ form: g.form, x: g.pos - W / 2, width: g.width, depth: g.depth, design: true });
  if (!opt.noSeparations) for (const s of st.separations || []) cuts.push({ form: s.form, x: s.pos - W / 2, width: s.width, depth: separationDepth(s) });
  cuts.sort((a, b) => a.x - b.x);
  for (const g of cuts) {
    const ol = grooveOutline(g.form, g, surf0);
    outer = spliceOutline(outer, ol);
    if (g.form === 'perlage') {
      const d = GROOVE_FORMS.perlage.beadRatio * g.width;
      beads.push({ ...beadRow(g.x, d, ol.floorZ, innerR), kind: 'groove' });
    }
  }
  return { loop: outer.concat(base.rest), outer, rest: base.rest, beads, baseOuter: base.outer, surf: surf0 };
}

// ------------------------------------------------------------ colour division
//
// §7 presets (VERIFIED list). 1-2-1 wave/diagonal: Wama's server returned
// 1:1:1 widths — we build the 1:2:1 the name promises.
export const DIVISIONS = {
  none: { type: 'none', rates: [1] },
  'vertical-1-1': { type: 'vertical', rates: [1, 1] },
  'vertical-1-2': { type: 'vertical', rates: [1, 2] },
  'vertical-1-3': { type: 'vertical', rates: [1, 3] },
  'wave-1-1': { type: 'wave', rates: [1, 1] },
  'diagonal-1-1': { type: 'diagonal', rates: [1, 1] },
  'vertical-1-1-1': { type: 'vertical', rates: [1, 1, 1] },
  'vertical-2-1-1': { type: 'vertical', rates: [2, 1, 1] },
  'vertical-3-1-1': { type: 'vertical', rates: [3, 1, 1] },
  'vertical-4-1-1': { type: 'vertical', rates: [4, 1, 1] },
  'vertical-1-2-1': { type: 'vertical', rates: [1, 2, 1] },
  'vertical-1-3-1': { type: 'vertical', rates: [1, 3, 1] },
  'vertical-1-4-1': { type: 'vertical', rates: [1, 4, 1] },
  'vertical-2-1-2': { type: 'vertical', rates: [2, 1, 2] },
  'diagonal-1-1-1': { type: 'diagonal', rates: [1, 1, 1] },
  'diagonal-1-2-1': { type: 'diagonal', rates: [1, 2, 1] },
  'diagonal-2-1-2': { type: 'diagonal', rates: [2, 1, 2] },
  'wave-1-1-1': { type: 'wave', rates: [1, 1, 1] },
  'wave-1-2-1': { type: 'wave', rates: [1, 2, 1] },
  'wave-2-1-2': { type: 'wave', rates: [2, 1, 2] },
  'vertical-free-2': { type: 'free', rates: [1, 1] },
  'vertical-free-3': { type: 'free', rates: [1, 1, 1] },
  'vertical-free-4': { type: 'free', rates: [1, 1, 1, 1] },
  'vertical-free-5': { type: 'free', rates: [1, 1, 1, 1, 1] },
};
export const WAVE_PERCENTAGES = [30, 40, 50, 60, 70];
export const WAVE_CYCLES = [1, 2, 3, 4, 5, 6];
// free cuts: outer bands ≥ 0.6, inner bands ≥ 0.5, step 0.01 (§7, VERIFIED)
export const FREE_LIMITS = { edgeMin: 0.6, bandMin: 0.5, step: 0.01 };
// our rule (Wama does not say): a wavy boundary's separation groove stays
// ≥ 0.5 mm from the ring edges and clear of chamfer corners
export const WAVE_EDGE_CLEAR = 0.5;

export function presetCuts(id, W) {
  const d = DIVISIONS[id] || DIVISIONS.none;
  const sum = d.rates.reduce((s, r) => s + r, 0);
  const cuts = []; let acc = 0;
  for (let i = 0; i < d.rates.length - 1; i++) { acc += (W * d.rates[i]) / sum; cuts.push(Math.round(acc * 1e4) / 1e4); }
  return cuts;
}
export const waveAmplitude = (pct, W) => (pct / 100) * (W / 2);

// Normalised division of a ring state → { type, cuts (mm from left), A, n }
export function divisionOf(st) {
  const dv = st.division || {};
  const def = DIVISIONS[dv.id] || DIVISIONS.none;
  const W = st.width || 4;
  if (def.type === 'none') return { type: 'none', cuts: [], A: 0, n: 0, bands: 1 };
  let cuts = def.type === 'free' && Array.isArray(dv.cuts) && dv.cuts.length === def.rates.length - 1 ? dv.cuts.slice() : presetCuts(dv.id, W);
  const wavy = def.type === 'wave' || def.type === 'diagonal';
  const A = wavy ? waveAmplitude(dv.pct || 30, W) : 0;
  const n = def.type === 'diagonal' ? 1 : (wavy ? (dv.cycles || 2) : 0);
  return { type: def.type, wavy, cuts, A, n, bands: def.rates.length };
}
// Boundary position (mm from left) of a cut at ring angle φ.
export const boundaryAt = (cut, A, n, phi) => cut - A * Math.sin(n * phi);

// Largest wave percentage that keeps every boundary ≥ WAVE_EDGE_CLEAR (plus
// the separation rim) inside the ring and off chamfer/slope corners.
export function wavePctAllowed(st, pct) {
  const W = st.width || 4, dv = divisionOf({ ...st, division: { ...(st.division || {}), pct } });
  if (!dv.wavy) return true;
  const base = splitLoop(baseLoop(st)).outer;
  let lo = 0, hi = W;
  for (const p of base) if (p[2]) { const x = p[0] + W / 2; if (x < W / 2) lo = Math.max(lo, x); else hi = Math.min(hi, x); }
  const sep = st.separation || SEPARATION_DEFAULT;
  const rim = sep.active === false ? 0 : grooveRimHalf(sep.form, sep.width);
  const clr = Math.max(WAVE_EDGE_CLEAR, rim + 0.05);
  return dv.cuts.every((c) => c - dv.A >= Math.max(lo + rim + 0.05, clr) && c + dv.A <= Math.min(hi - rim - 0.05, W - clr));
}

// ------------------------------------------------------------ area / volume

function clipX(poly, k, keepLeft) {
  const out = [], n = poly.length;
  const inside = (p) => (keepLeft ? p[0] <= k : p[0] >= k);
  for (let i = 0; i < n; i++) {
    const a = poly[i], b = poly[(i + 1) % n], ia = inside(a), ib = inside(b);
    if (ia) out.push(a);
    if (ia !== ib) { const t = (k - a[0]) / (b[0] - a[0]); out.push([k, a[1] + (b[1] - a[1]) * t]); }
  }
  return out;
}
// area + ∫ z dA of a polygon
function areaMoment(poly) {
  let A = 0, Mz = 0;
  for (let i = 0; i < poly.length; i++) {
    const [x1, z1] = poly[i], [x2, z2] = poly[(i + 1) % poly.length];
    const cr = x1 * z2 - x2 * z1;
    A += cr; Mz += (z1 + z2) * cr;
  }
  return { A: A / 2, Mz: Mz / 6 };
}
// Section split at centred x cuts → per band ∫ r dA (r = innerR + z), mm³/rad
function bandMoments(loop, cutsC, innerR) {
  const edges = [-Infinity, ...cutsC, Infinity], out = [];
  for (let b = 0; b < edges.length - 1; b++) {
    let p = loop;
    if (edges[b] > -Infinity) p = clipX(p, edges[b], false);
    if (edges[b + 1] < Infinity) p = clipX(p, edges[b + 1], true);
    if (p.length < 3) { out.push({ A: 0, M: 0 }); continue; }
    const { A, Mz } = areaMoment(p), s = Math.sign(A) || 1;
    out.push({ A: A * s, M: (A * innerR + Mz) * s });
  }
  return out;
}

// Exact metal volume per colour band (mm³), grooves removed, beads added.
// Straight division: one section, Pappus. Wavy: ∫ over φ of the section split
// at the moving boundary; the separation groove there is taken off the static
// section (it is 0.01–0.06 mm², overlap with a crossing design groove ignored).
export function bandVolumes(st, phiSamples = 96) {
  const W = st.width || 4, innerR = (st.size || 54) / (2 * Math.PI);
  const dv = divisionOf(st);
  const sep = st.separation || SEPARATION_DEFAULT;
  const sepOn = dv.bands > 1 && sep.active !== false;
  const seps = sepOn && !dv.wavy ? dv.cuts.map((c) => ({ ...sep, pos: c })) : [];
  const sec = buildSection({ ...st, separations: seps }, { fine: true });
  const vol = new Array(dv.bands).fill(0);
  const bandOfX = (xLeft, phi) => { let k = 0; for (const c of dv.cuts) if (xLeft > boundaryAt(c, dv.A, dv.n, phi)) k++; return k; };
  if (!dv.wavy) {
    bandMoments(sec.loop, dv.cuts.map((c) => c - W / 2), innerR).forEach((b, i) => { vol[i] += 2 * Math.PI * b.M; });
  } else {
    const S = phiSamples;
    for (let s = 0; s < S; s++) {
      const phi = (2 * Math.PI * (s + 0.5)) / S;
      const cutsC = dv.cuts.map((c) => boundaryAt(c, dv.A, dv.n, phi) - W / 2);
      const bm = bandMoments(sec.loop, cutsC, innerR);
      bm.forEach((b, i) => { vol[i] += ((2 * Math.PI) / S) * b.M; });
      if (sepOn) cutsC.forEach((xc, i) => {
        const ol = grooveOutline(sep.form, { x: xc, width: sep.width, depth: separationDepth(sep) }, sec.surf);
        const rm = grooveRemoved(ol, sec.surf, innerR);
        vol[i] -= ((2 * Math.PI) / S) * rm.Mleft;
        vol[i + 1] -= ((2 * Math.PI) / S) * rm.Mright;
      });
    }
  }
  for (const b of sec.beads) vol[Math.min(dv.bands - 1, bandOfX(b.x + W / 2, 0))] += b.volume;
  return vol;
}

// Area between the surface and one groove outline, split at the groove centre
// line → ∫ r dA left/right of it (for the wavy separation groove).
export function grooveRemoved(outline, surf, innerR, step = 0.002) {
  const pts = outline.points, xs = pts.map((p) => p[0]);
  const x0 = Math.min(...xs), x1 = Math.max(...xs), xm = (x0 + x1) / 2;
  const low = zLowOf(pts, false);
  let A = 0, Mleft = 0, Mright = 0;
  for (let x = x0; x < x1; x += step) {
    const xc = x + step / 2, t = surf(xc), b = low(xc);
    if (t === null || b === null) continue;
    const h = Math.max(0, t - b), m = h * step * (innerR + (t + b) / 2);
    A += h * step;
    if (xc < xm) Mleft += m; else Mright += m;
  }
  return { area: A, Mleft, Mright };
}

export function ringVolume(st) { return bandVolumes(st).reduce((s, v) => s + v, 0); }

// ------------------------------------------------------------ sweep (3D)
//
// What the 3D band is built from. Straight rings (any straight division):
// one section (separation grooves included) → a plain lathe. Wave/diagonal
// division: the lathe is the section WITHOUT the separation grooves, plus one
// "groove strip" per boundary: the separation groove outline at every slice
// φ = 2π·i/segments (same point count in every slice), which the scene sweeps
// into the groove walls; the band surface above them is cut away in the
// shader (|y − boundary(φ)| < rim half-width). The groove is exact in every
// slice and its corners keep the same vertex index all the way round.
export function sweepSections(st, segments) {
  const W = st.width || 4;
  const dv = divisionOf(st);
  const sep = st.separation || SEPARATION_DEFAULT;
  const sepOn = dv.bands > 1 && sep.active !== false;
  if (!dv.wavy || !sepOn) {
    const seps = sepOn ? dv.cuts.map((c) => ({ ...sep, pos: c })) : [];
    const sec = buildSection({ ...st, separations: seps });
    return { loop: sec.loop, beads: sec.beads, division: dv, strips: null };
  }
  const sec = buildSection(st);
  const statTop = zTopOf(sec.outer, false);
  const depth = separationDepth(sep);
  const strips = dv.cuts.map((c) => {
    const slices = [];
    for (let i = 0; i <= segments; i++) {
      const phi = (2 * Math.PI * i) / segments;
      slices.push(grooveOutline(sep.form, { x: boundaryAt(c, dv.A, dv.n, phi) - W / 2, width: sep.width, depth }, statTop).points);
    }
    return slices;
  });
  return { loop: sec.loop, beads: sec.beads, division: dv, strips, stripHalf: grooveRimHalf(sep.form, sep.width) };
}

// ------------------------------------------------------------ placement rules
//
// §11/§19 (ESTIMATED from Wama's MoveGroove / grooveCollision): a groove's rim
// stays ≥ 0.5 mm from the ring edge (or an edge step) and from every other
// groove's rim (incl. straight separation grooves); positions step 0.01.
export const GROOVE_GAP = 0.5;

// Obstacles [lo, hi, gap?] in mm from the left edge: edge steps + straight
// separation grooves + the other design grooves + a stone already set
// (st.stone = { lo, hi } = its seat opening; a groove keeps STONE_GAP of
// metal to it).
export const STONE_GAP = 0.2;
export function grooveObstacles(st, skipIndex = -1) {
  const W = st.width || 4, obs = [];
  if (st.stone && st.stone.hi > st.stone.lo) obs.push([st.stone.lo, st.stone.hi, STONE_GAP]);
  const e = st.edges || {};
  obs.push([-Infinity, e.left && e.left.form !== 'none' ? e.left.width + (e.left.form === 'perlage' ? 0.05 : 0) : 0]);
  obs.push([e.right && e.right.form !== 'none' ? W - e.right.width - (e.right.form === 'perlage' ? 0.05 : 0) : W, Infinity]);
  const dv = divisionOf(st), sep = st.separation || SEPARATION_DEFAULT;
  if (dv.bands > 1 && !dv.wavy && sep.active !== false) {
    const h = grooveRimHalf(sep.form, sep.width);
    for (const c of dv.cuts) obs.push([c - h, c + h]);
  }
  (st.grooves || []).forEach((g, i) => {
    if (i === skipIndex) return;
    const h = grooveRimHalf(g.form, g.width);
    obs.push([g.pos - h, g.pos + h]);
  });
  return obs;
}
// Feasible centre intervals for a groove of (form, width) among obstacles.
export function freeIntervals(st, form, width, skipIndex = -1) {
  const h = grooveRimHalf(form, width);
  const obs = grooveObstacles(st, skipIndex).sort((a, b) => a[0] - b[0]);
  const out = [];
  let left = -Infinity, leftGap = GROOVE_GAP;
  for (const [lo, hi, gap = GROOVE_GAP] of obs) {
    if (lo > left) {
      const a = left + leftGap + h, b = lo - gap - h;
      if (left > -Infinity && b >= a - 1e-9) out.push([round2up(a), round2dn(b)]);
    }
    if (hi >= left) { left = hi; leftGap = gap; }
  }
  return out.filter(([a, b]) => b >= a);
}
const round2up = (v) => Math.ceil(v * 100 - 1e-6) / 100;
const round2dn = (v) => Math.floor(v * 100 + 1e-6) / 100;

// New groove position: the ring centre if free, else the middle of the widest
// free interval (ties → right). Reproduces Wama's 2.5 → 3.8 → 1.2 → reject
// on a 5 mm ring with V90 0.2. null = no room.
export function autoGroovePos(st, form, width) {
  const W = st.width || 4, iv = freeIntervals(st, form, width);
  if (!iv.length) return null;
  const mid = Math.round((W / 2) * 100) / 100;
  if (iv.some(([a, b]) => mid >= a && mid <= b)) return mid;
  let best = iv[0];
  for (const it of iv) if (it[1] - it[0] >= best[1] - best[0] - 1e-9) best = it;
  return Math.round(((best[0] + best[1]) / 2) * 100) / 100;
}
// Requested position → nearest allowed one (Wama MoveGroove); null = the
// groove fits nowhere (grooveCollision → keep the old state).
export function placeGroove(st, index, form, width, wanted) {
  const iv = freeIntervals(st, form, width, index);
  if (!iv.length) return null;
  let best = null, bd = Infinity;
  for (const [a, b] of iv) {
    const p = Math.min(b, Math.max(a, wanted)), d = Math.abs(p - wanted);
    if (d < bd - 1e-9) { bd = d; best = p; }
  }
  return Math.round(best * 100) / 100;
}

// Thinnest wall under [xl, xr] (mm from left) of the BASE section.
export function minWall(st, xl, xr) {
  const W = st.width || 4, loop = baseLoop(st);
  const top = zTopOf(loop, true), low = zLowOf(loop, true);
  let m = Infinity;
  for (let k = 0; k <= 20; k++) {
    const x = xl + ((xr - xl) * k) / 20 - W / 2;
    const t = top(x), b = low(x);
    if (t !== null && b !== null) m = Math.min(m, t - b);
  }
  return m;
}
// §13 (ESTIMATED): depth ≤ 0.5 × the thinnest wall under the groove.
export function depthAllowed(st, form, width, depth, pos) {
  const h = grooveRimHalf(form, width);
  return depth <= 0.5 * minWall(st, pos - h, pos + h) + 1e-9;
}

// Price class (§22, VERIFIED; classes don't stack, the highest wins).
export function priceClass(st) {
  const dv = divisionOf(st);
  if (dv.bands > 1 && dv.wavy) return 'wavy';
  if (dv.bands > 1) return 'multi';
  const e = st.edges || {};
  if ((st.grooves || []).some((g) => SPECIAL_GROOVES.includes(g.form)) ||
      (e.left && e.left.form && e.left.form !== 'none') || (e.right && e.right.form && e.right.form !== 'none')) return 'special';
  return 'simple';
}
