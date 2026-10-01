// wamaMetalsGrooves.js — reference reconstruction of Wama Gold metals, colour divisions, grooves, volume and price.
// Reverse-engineered on 2026-10-01 from the live configurator (JSON-RPC state, price endpoint and the three.js meshes).
// See FAZA4-metali-i-zlebovi.md. Pure JS, no dependencies. Works together with wamaProfile.js (Faza 3).
//
// Coordinates (same as wamaProfile.js, except x origin):
//   x = across the band, measured from the LEFT edge of the ring (0 .. W)   <- wamaProfile.js uses x centred; use fromSection()
//   z = radial height above the finger line (z = 0 lies on the inner circumference = ring size; z = H is the outer apex)
//   radius r = innerCircumference / (2*PI) + z
// Units: mm, g, cm3 where noted.

const PI = Math.PI;

// ------------------------------------------------------------------------------------------------
// 1. METALS  (VERIFIED from the price endpoint: density = weight / volume, identical for every ring tested)
// ------------------------------------------------------------------------------------------------
export const ALLOYS = {
  // id: { label (PL UI), finenesses offered, gradient (3D LUT id), rhodium possible }
  yellow:    { label: 'Żółte złoto',     finenesses: [333, 375, 585, 750], gradient: 'yellow',    rhodium: false },
  white:     { label: 'Białe złoto',     finenesses: [333, 375, 585, 750], gradient: 'white',     rhodium: true  },
  red:       { label: 'Czerwone złoto',  finenesses: [333, 375, 585, 750], gradient: 'red',       rhodium: false },
  manganese: { label: 'Manganowe złoto', finenesses: [585],                gradient: 'manganese', rhodium: false, singleColourOnly: true },
  'white-pd':{ label: 'Białe złoto (PD)',finenesses: [585],                gradient: 'white-pd',  rhodium: false },
};
// g/cm3. Same value for yellow / white / red at the same fineness (the configurator does not distinguish them).
export const DENSITY = { 333: 10.9, 375: 11.2, 585: 13.3, 750: 15.5, 'manganese/585': 12.2, 'white-pd/585': 14.8 };
export function density(color, fineness) {
  const k = `${color}/${fineness}`;
  return DENSITY[k] ?? DENSITY[fineness];
}

// ------------------------------------------------------------------------------------------------
// 2. PRICE  (VERIFIED: ek = weight * pricePerGram(fineness, class) + surcharges ; vk = 2.46 * ek ; shown = round(vk))
//    Values in PLN for the Polish site on 2026-10-01. They are the competitor's numbers, only for comparison.
// ------------------------------------------------------------------------------------------------
export const PRICE_PER_GRAM_EK = {
  //        simple  specialGroove  multicolour  wavy
  333: { simple: 237, special: 253, multi: 270, wavy: 305 },
  375: { simple: 260, special: 275, multi: 293, wavy: 327 },
  585: { simple: 371, special: 384, multi: 398, wavy: 427 },
  750: { simple: 459, special: 471, multi: 483, wavy: 508 },
};
export const VK_FACTOR = 2.46;
export const SURFACE_SURCHARGE_EK = { // flat per ring, added once (VERIFIED at W5 and W8)
  polished: 0, 'sand-matt': 15, 'brushed-matt-crosswise': 15, 'brushed-matt-diagonal': 15, 'brushed-matt-lengthwise': 15,
  'strong-brushed-matt-lengthwise': 15, 'diamond-matt': 15, 'ice-matt': 15, 'bark-style-2': 35, 'hammered-matt': 75, hammered: 80,
};
export const SPECIAL_GROOVES = ['v-groove-60', 'u-groove', 'square-groove', 'perlage'];      // trigger the "special" class
export const FREE_GROOVES = ['v-groove-90', 'v-groove-120', 'convex-u-groove'];              // no price effect

// priceClass: 'wavy' if division type is wave/diagonal, else 'multi' if > 1 band, else 'special' if a special groove or an
// edge (normal or perlage) exists, else 'simple'. Classes do not stack (the highest wins).
export function priceClass({ divisionType = 'vertical', bandCount = 1, grooves = [], edges = [] }) {
  if (bandCount > 1 && (divisionType === 'wave' || divisionType === 'diagonal')) return 'wavy';
  if (bandCount > 1) return 'multi';
  if (grooves.some(g => SPECIAL_GROOVES.includes(g.form)) || edges.some(e => e && e !== 'none')) return 'special';
  return 'simple';
}

// bands: [{ color, fineness, weight_g }] — weight from fullBandWeights() (groove volume is NOT removed for the price)
export function wamaPrice({ bands, cls = 'simple', surfaces = ['polished'], rhodiumOnAnyBand = false }) {
  const fineness = bands[0].fineness;                       // one fineness per ring (server forces it)
  const W = bands.reduce((s, b) => s + b.weight_g, 0);
  let ek = W * PRICE_PER_GRAM_EK[fineness][cls];
  let extra = 0;
  extra += Math.max(...surfaces.map(s => SURFACE_SURCHARGE_EK[s] ?? 0));  // ESTIMATED: counted once (max) — two hammered bands = 80
  if (rhodiumOnAnyBand) extra += 50;
  if (bands.some(b => b.color === 'manganese')) extra += 50;
  extra += bands.filter(b => b.color === 'white-pd').reduce((s, b) => s + 50 * b.weight_g, 0);
  ek += extra;
  return { weight_g: W, ek, ekSurcharges: extra, vk: ek * VK_FACTOR, shown: Math.round(ek * VK_FACTOR) };
}

// ------------------------------------------------------------------------------------------------
// 3. GEOMETRY HELPERS
// ------------------------------------------------------------------------------------------------
// wamaProfile.js section ([[xCentred, z]...], closed) -> x from left edge
export function fromSection(points, W) { return points.map(([x, z]) => [x + W / 2, z]); }

// outer surface height z(x): highest crossing of the closed outline at x
export function surfaceFn(polyLeft) {
  return (x) => {
    let best = null;
    for (let i = 0; i < polyLeft.length; i++) {
      const [x1, z1] = polyLeft[i], [x2, z2] = polyLeft[(i + 1) % polyLeft.length];
      if ((x1 - x) * (x2 - x) <= 0 && x1 !== x2) { const z = z1 + (z2 - z1) * (x - x1) / (x2 - x1); if (best === null || z > best) best = z; }
    }
    return best;
  };
}

// ------------------------------------------------------------------------------------------------
// 4. GROOVES  (design grooves, tab "Rowki / Nacięcia"). Options are identical for every profile, ring width and ring.
// ------------------------------------------------------------------------------------------------
export const GROOVE_OPTIONS = {
  // width/depth in mm. V forms: width and depth are locked by the angle (choose one, the other follows).
  'v-groove-60':  { type: 'v', angle: 60,  widths: [0.2, 0.3, 0.4, 0.5], depthFor: w => w / 2 / Math.tan(30 * PI / 180) }, // 0.17321 .. 0.43301
  'v-groove-90':  { type: 'v', angle: 90,  widths: [0.2, 0.3, 0.4, 0.5], depthFor: w => w / 2 },                          // 0.10 .. 0.25
  'v-groove-120': { type: 'v', angle: 120, widths: [0.2, 0.3, 0.4, 0.5], depthFor: w => w / 2 / Math.tan(60 * PI / 180) }, // 0.05774 .. 0.14434
  // U: 7 fixed presets (width, depth); picking a width or a depth selects the whole preset
  'u-groove':     { type: 'u', presets: [[0.35, 0.03], [0.5, 0.06], [0.8, 0.15], [1.0, 0.27], [1.5, 0.3], [2.0, 0.4], [1.2, 0.6]] },
  'convex-u-groove': { type: 'bump', widths: [1.0, 1.5], heights: [0.1] },
  // square: width and depth independent
  'square-groove':{ type: 'rect', widths: [0.3, 0.5, 0.8, 1.0, 1.5, 2.0], depths: [0.05, 0.1, 0.15, 0.2, 0.25, 0.3, 0.35, 0.4, 0.45, 0.5], chamfer: 0.1 },
  // perlage: channel (square, 0.05 chamfer) + row of beads, bead diameter = 7/9 * width
  'perlage':      { type: 'perlage', widths: [0.35, 0.5, 0.75, 0.9, 1.2], channelDepth: 0.1, channelChamfer: 0.05, beadRatio: 7 / 9 },
};
// UI slider limits (from the left edge): [m, W - m] with m = V: w/2 + 0.3 | U: w/2 + 0.15 | square: w/2 + 0.2 | perlage: w/2 | convex: 0
// Server adaptation (ESTIMATED from MoveGroove/grooveCollision behaviour): groove edge >= 0.5 mm from each ring edge and
// >= 0.5 mm from neighbouring grooves; grooves also avoid the stone position. Depth list is filtered so that
// depth <= 0.5 * local wall thickness under the groove (ESTIMATED).

// Returns the outline of one groove (replaces the outer surface between rimL and rimR), points left -> right, z above finger line.
export function grooveOutline(form, { pos, width, depth }, surf, step = 0.01) {
  const o = GROOVE_OPTIONS[form]; if (!o) throw new Error('unknown groove form ' + form);
  const zAt = surf;
  if (o.type === 'v') {
    // VERIFIED: rims at x = pos ± w/2 on the surface (not rotated); bottom at x = pos, z = mean(rim z) - depth
    const d = depth ?? o.depthFor(width);
    const xl = pos - width / 2, xr = pos + width / 2, zl = zAt(xl), zr = zAt(xr);
    return { points: [[xl, zl], [pos, (zl + zr) / 2 - d], [xr, zr]], rim: [xl, xr] };
  }
  if (o.type === 'rect') {
    // VERIFIED: 45° chamfer of 0.1 outside the nominal width on both sides (chamfer drops 0.1 below the local surface),
    // vertical walls, flat floor at z = min(outer rim z) - depth. Nominal width = floor width; opening = width + 0.2.
    const c = o.chamfer, xl = pos - width / 2, xr = pos + width / 2;
    const zol = zAt(xl - c), zor = zAt(xr + c), zf = Math.min(zol, zor) - depth;
    return { points: [[xl - c, zol], [xl, zol - c], [xl, zf], [xr, zf], [xr, zor - c], [xr + c, zor]], rim: [xl - c, xr + c] };
  }
  if (o.type === 'perlage') {
    // VERIFIED (channel): square channel width w, depth 0.1, chamfer 0.05; beads: see perlageBeads()
    const c = o.channelChamfer, xl = pos - width / 2, xr = pos + width / 2;
    const zol = zAt(xl - c), zor = zAt(xr + c), zf = Math.min(zol, zor) - o.channelDepth;
    return { points: [[xl - c, zol], [xl, zol - c], [xl, zf], [xr, zf], [xr, zor - c], [xr + c, zor]], rim: [xl - c, xr + c] };
  }
  // U and convex are rotated with the local surface slope (VERIFIED on P16 off-centre: rims within 0.004 mm, bottom 0.002 mm)
  const h = 1e-4, slope = (zAt(pos + h) - zAt(pos - h)) / (2 * h), th = Math.atan(slope);
  const xl = pos - width / 2 * Math.cos(th), xr = pos + width / 2 * Math.cos(th);
  const p1 = [xl, zAt(xl)], p2 = [xr, zAt(xr)];
  const L = Math.hypot(p2[0] - p1[0], p2[1] - p1[1]), t = [(p2[0] - p1[0]) / L, (p2[1] - p1[1]) / L], n = [t[1], -t[0]]; // n points into the metal
  const m = [(p1[0] + p2[0]) / 2, (p1[1] + p2[1]) / 2];
  const pts = [];
  if (o.type === 'u') {
    // circular arc between the rims, sagitta = depth (+ a 0.01 mm vertical step at both rims)
    const s0 = 0.01, c = L / 2, d = depth, R = (c * c + d * d) / (2 * d);
    const a1 = [p1[0], p1[1] - s0], a2 = [p2[0], p2[1] - s0];
    pts.push(p1, a1);
    const N = Math.max(8, Math.ceil(L / step));
    for (let k = 1; k < N; k++) {
      const u = -c + (2 * c) * k / N;                      // along chord
      const v = d - (R - Math.sqrt(Math.max(0, R * R - u * u))); // depth below chord at u
      pts.push([m[0] + t[0] * u + n[0] * (v + s0), m[1] + t[1] * u + n[1] * (v + s0)]);
    }
    pts.push(a2, p2);
    return { points: pts, rim: [xl, xr] };
  }
  if (o.type === 'bump') {
    // convex floor: circular arc with sagitta hgt (0.1) whose apex touches the original surface at x = pos; the chord
    // (length = width) lies hgt below the apex along the local normal. Side walls run along the normal from the surface down
    // to the chord ends, so on a flat top the walls are hgt deep and on a dome they are shallower (hgt - dome sag).
    // VERIFIED on P1 8x2 (≤0.0001 mm) and P16 6x2 (see validation).
    const hgt = depth ?? 0.1, c = width / 2, R = (c * c + hgt * hgt) / (2 * hgt);
    const tt = [Math.cos(th), Math.sin(th)], nn = [Math.sin(th), -Math.cos(th)];      // tangent at pos, normal into the metal
    const A = [pos, zAt(pos)], M = [A[0] + nn[0] * hgt, A[1] + nn[1] * hgt];
    const E1 = [M[0] - tt[0] * c, M[1] - tt[1] * c], E2 = [M[0] + tt[0] * c, M[1] + tt[1] * c];
    const toSurface = (E) => { let s = 0; for (let it = 0; it < 40; it++) { const P = [E[0] - nn[0] * s, E[1] - nn[1] * s]; const f = P[1] - zAt(P[0]); s -= f / (-nn[1] - 1e-9); } return [E[0] - nn[0] * s, E[1] - nn[1] * s]; };
    const r1 = toSurface(E1), r2 = toSurface(E2);
    pts.push(r1, E1);
    const N = Math.max(8, Math.ceil(width / step));
    for (let k = 1; k < N; k++) { const u = -c + (2 * c) * k / N; const v = R - Math.sqrt(Math.max(0, R * R - u * u)); pts.push([M[0] + tt[0] * u - nn[0] * (hgt - v), M[1] + tt[1] * u - nn[1] * (hgt - v)]); }
    pts.push(E2, r2);
    return { points: pts, rim: [r1[0], r2[0]] };
  }
  throw new Error('unhandled type');
}

// Perlage beads (ESTIMATED shape): diameter d = 7/9 * width, centred on the groove, spaced so they touch.
export function perlageBeads({ pos, width }, surf, innerCirc) {
  const d = GROOVE_OPTIONS.perlage.beadRatio * width;
  const rFloor = innerCirc / (2 * PI) + surf(pos) - GROOVE_OPTIONS.perlage.channelDepth; // radius of the channel floor
  const count = Math.floor(2 * PI * rFloor / d);             // ESTIMATED; reproduces the measured 104 beads (d 0.70, P16 6x2) and 79 beads (d 0.933, P1 8x2)
  return { diameter: d, count, pitchRad: 2 * PI / count, protrusionAboveSurface: 'measured 0.10–0.17 mm (ESTIMATED)' };
}

// Edge (tab "Krawędź"): 'normal' = rabbet (step) of width w and depth d at the ring edge; 'perlage' = channel + beads at the edge.
export const EDGE_OPTIONS = {
  normal:  { widths: [0.3, 0.5, 0.8, 1.0, 1.5, 2.0], depths: [0.05, 0.1, 0.15, 0.2, 0.25, 0.3, 0.35, 0.4, 0.45, 0.5] },
  perlage: { widths: [0.325, 0.445, 0.645, 0.8], beads: [0.3, 0.39, 0.54, 0.7], channel: [0.35, 0.5, 0.75, 0.9], depth: 0.1 },
};
export function edgeRabbetOutline(side, { width, depth }, surf, W) {
  // VERIFIED on P1: floor at z = surf(edge band) - depth from the ring edge to x = width (merges into the corner fillet)
  const x0 = side === 'left' ? 0 : W - width, x1 = side === 'left' ? width : W;
  const zIn = surf(side === 'left' ? x1 : x0);
  return { floorZ: zIn - depth, x: [x0, x1] };
}

// ------------------------------------------------------------------------------------------------
// 5. OUTER OUTLINE WITH GROOVES, AREAS AND VOLUMES
// ------------------------------------------------------------------------------------------------
// area between the original surface and the groove outline (mm²) and its centroid z (for Pappus)
export function grooveRemovedArea(outline, surf, step = 0.002) {
  const pts = outline.points; const xs = pts.map(p => p[0]);
  const x0 = Math.min(...xs), x1 = Math.max(...xs);
  const zg = (x) => { // lowest outline z at x (groove bottom)
    let best = null; for (let i = 0; i < pts.length - 1; i++) { const [a, za] = pts[i], [b, zb] = pts[i + 1]; if ((a - x) * (b - x) <= 0 && a !== b) { const z = za + (zb - za) * (x - a) / (b - a); if (best === null || z < best) best = z; } }
    return best;
  };
  let A = 0, M = 0;
  for (let x = x0; x < x1; x += step) { const xm = x + step / 2, top = surf(xm), bot = zg(xm); if (top === null || bot === null) continue; const h = Math.max(0, top - bot); A += h * step; M += h * step * (top + bot) / 2; }
  return { area: A, centroidZ: A > 0 ? M / A : 0 };
}

// Pappus: volume (mm³) of an area with centroid at height z above the finger line
export function revolve(area, centroidZ, innerCirc) { return area * 2 * PI * (innerCirc / (2 * PI) + centroidZ); }

// Full section area split into straight bands by cut positions (x from left). Returns [{area, centroidZ}] per band.
export function bandAreas(polyLeft, W, cuts = [], step = 0.002) {
  const surf = surfaceFn(polyLeft);
  const low = (x) => { let best = null; for (let i = 0; i < polyLeft.length; i++) { const [x1, z1] = polyLeft[i], [x2, z2] = polyLeft[(i + 1) % polyLeft.length]; if ((x1 - x) * (x2 - x) <= 0 && x1 !== x2) { const z = z1 + (z2 - z1) * (x - x1) / (x2 - x1); if (best === null || z < best) best = z; } } return best; };
  const edges = [0, ...cuts, W]; const out = [];
  for (let b = 0; b < edges.length - 1; b++) {
    let A = 0, M = 0;
    for (let x = edges[b]; x < edges[b + 1] - 1e-9; x += step) { const xm = Math.min(x + step / 2, edges[b + 1]); const dx = Math.min(step, edges[b + 1] - x); const t = surf(xm), l = low(xm); if (t === null || l === null) continue; A += (t - l) * dx; M += (t - l) * dx * (t + l) / 2; }
    out.push({ area: A, centroidZ: M / A });
  }
  return out;
}

// Band weights as the competitor prices them: full section (no groove / edge / separation volume removed).
// bands: [{color, fineness}] ; cuts: straight cut positions; for wave/diagonal divisions the competitor's price weights equal
// the straight-cut weights at the mean offset (VERIFIED for wave-1-1 and diagonal presets on P1).
export function fullBandWeights(polyLeft, W, cuts, bands, innerCirc) {
  return bandAreas(polyLeft, W, cuts).map((b, i) => {
    const vol_mm3 = revolve(b.area, b.centroidZ, innerCirc);
    return { ...bands[i], vol_mm3, weight_g: vol_mm3 / 1000 * density(bands[i].color, bands[i].fineness) };
  });
}

// Real metal weight (for our own pricing, if we decide to price the true metal): full weight minus groove volumes.
export function realWeight(polyLeft, W, innerCirc, color, fineness, grooveList) {
  const full = fullBandWeights(polyLeft, W, [], [{ color, fineness }], innerCirc)[0];
  const surf = surfaceFn(polyLeft);
  let removed = 0;
  for (const g of grooveList) { const o = grooveOutline(g.form, g, surf); const a = grooveRemovedArea(o, surf); removed += revolve(a.area, a.centroidZ, innerCirc); }
  return { full_g: full.weight_g, removed_mm3: removed, real_g: (full.vol_mm3 - removed) / 1000 * density(color, fineness) };
}

// ------------------------------------------------------------------------------------------------
// 6. COLOUR DIVISIONS (tab "Metale szlachetne" -> "Wybierz wzór obrączki / podział kolorów")
// ------------------------------------------------------------------------------------------------
// Bands run around the whole circumference; the ring is split ACROSS ITS WIDTH (never around the circumference).
// disc width = W * rate / sum(rates); cut i = sum of previous widths (mm from the left edge).
export const DIVISIONS = {
  none: { type: 'vertical', rates: [1] },
  'vertical-1-1': { type: 'vertical', rates: [1, 1] }, 'vertical-1-2': { type: 'vertical', rates: [1, 2] }, 'vertical-1-3': { type: 'vertical', rates: [1, 3] },
  'wave-1-1': { type: 'wave', rates: [1, 1], cycles: [1, 2, 3, 4, 5, 6], defaultCycles: 2, percentages: [30, 40, 50, 60, 70] },
  'diagonal-1-1': { type: 'diagonal', rates: [1, 1], cycles: 1, percentages: [30, 40, 50, 60, 70] },
  'vertical-1-1-1': { type: 'vertical', rates: [1, 1, 1] }, 'vertical-2-1-1': { type: 'vertical', rates: [2, 1, 1] }, 'vertical-3-1-1': { type: 'vertical', rates: [3, 1, 1] },
  'vertical-4-1-1': { type: 'vertical', rates: [4, 1, 1] }, 'vertical-1-2-1': { type: 'vertical', rates: [1, 2, 1] }, 'vertical-1-3-1': { type: 'vertical', rates: [1, 3, 1] },
  'vertical-1-4-1': { type: 'vertical', rates: [1, 4, 1] }, 'vertical-2-1-2': { type: 'vertical', rates: [2, 1, 2] },
  'diagonal-1-1-1': { type: 'diagonal', rates: [1, 1, 1], cycles: 1 }, 'diagonal-1-2-1': { type: 'diagonal', rates: [1, 2, 1], cycles: 1, note: 'server returned 1:1:1 widths' },
  'diagonal-2-1-2': { type: 'diagonal', rates: [2, 1, 2], cycles: 1 },
  'wave-1-1-1': { type: 'wave', rates: [1, 1, 1], defaultCycles: 2 }, 'wave-1-2-1': { type: 'wave', rates: [1, 2, 1], defaultCycles: 2, note: 'server returned 1:1:1 widths' },
  'wave-2-1-2': { type: 'wave', rates: [2, 1, 2], defaultCycles: 2 },
  'vertical-free-2': { type: 'vertical', rates: [1, 1], free: true }, 'vertical-free-3': { type: 'vertical', rates: [1, 1, 1], free: true },
  'vertical-free-4': { type: 'vertical', rates: [1, 1, 1, 1], free: true }, 'vertical-free-5': { type: 'vertical', rates: [1, 1, 1, 1, 1], free: true },
};
export function divisionCuts(id, W) {
  const d = DIVISIONS[id]; const sum = d.rates.reduce((s, r) => s + r, 0); const cuts = []; let acc = 0;
  for (let i = 0; i < d.rates.length - 1; i++) { acc += W * d.rates[i] / sum; cuts.push(acc); }
  return cuts;
}
// boundary position around the ring (theta in radians): x_b = cut - A * sin(n * theta); A = pct/100 * W/2 (VERIFIED amplitude;
// sign/phase convention ESTIMATED). Straight divisions: A = 0. Diagonal = one cycle. All boundaries of a ring share A, n, phase.
export function boundaryX(cut, W, { pct = 0, cycles = 1 } = {}, theta) { return cut - (pct / 100) * (W / 2) * Math.sin(cycles * theta); }
// free divisions: each cut movable in 0.01 mm steps; outer bands >= 0.6 mm, inner bands >= 0.5 mm (VERIFIED from slider limits)
export const FREE_LIMITS = { edgeMin: 0.6, bandMin: 0.5, step: 0.01 };
// separation groove at every boundary (automatic): V90 0.2 x 0.1, polished, both halves belong to the adjacent bands.
export const SEPARATION_DEFAULT = { form: 'v-groove-90', width: 0.2, depth: 0.1, surface: 'polished', widths: [0.2, 0.3, 0.4, 0.5], depths: [0.1, 0.15, 0.2, 0.25], forms: ['v-groove-60', 'v-groove-90', 'v-groove-120', 'u-groove', 'square-groove'] };
