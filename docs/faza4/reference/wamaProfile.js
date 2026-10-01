// wamaProfile.js — reference reconstruction of the Wama Gold wedding-band cross-section (profiles P1–P24).
// Reverse-engineered from the cross-sections their API returns (see FAZA3-geometrija.md). Pure JS, no dependencies.
//
// Units: mm.
// Output coordinates ("section space"):
//   x = across the band, 0 = centre, from -W/2 to +W/2
//   z = radial height above the FINGER LINE. z = 0 is the inner apex (lies exactly on the inner circumference = ring size),
//       z = H is the outer apex.  To place on the ring: radius = innerCircumference / (2*PI) + z.
//
// Nominal thickness H (their "wysokość") = max(z) - min(z) = radial distance inner apex -> outer apex. It is NOT the side-wall height.

const PI = Math.PI;

// ---------------------------------------------------------------------------------------------
// Generic construction: top primitive + top corner fillet + straight side wall + inner fillet + inner primitive.
// Internally y points DOWN with y = 0 in the middle of H (outer apex at y = -H/2, inner apex at y = +H/2).
// spec = {
//   top:   {type:'flat'} | {type:'dome', R} | {type:'chamfer', dx, dy} | {type:'concave', R},
//   rt:    top corner fillet radius (ignored for chamfer),
//   inner: {type:'flat'} | {type:'dome', R} | {type:'slope', wall, dx, R},
//   ri:    inner corner fillet radius (auto-shrinks if the wall would become negative; ignored for slope)
// }
// ---------------------------------------------------------------------------------------------
export function buildSection(W, H, spec, step = 0.01) {
  const c = W / 2;
  const right = [];                     // right half, from outer apex (x=0) to inner apex (x=0), y-down
  const arc = (cx, cy, r, a0, a1) => {  // shortest sweep a0 -> a1
    let da = a1 - a0; while (da > PI) da -= 2 * PI; while (da < -PI) da += 2 * PI;
    const n = Math.max(2, Math.ceil(Math.abs(da) * r / step));
    for (let k = 0; k < n; k++) { const a = a0 + da * k / n; right.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]); }
  };
  const line = (x0, y0, x1, y1) => {
    const n = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0) / step));
    for (let k = 0; k < n; k++) right.push([x0 + (x1 - x0) * k / n, y0 + (y1 - y0) * k / n]);
  };
  const ang = (x, y, cx, cy) => Math.atan2(y - cy, x - cx);

  // ---- top ----
  let ytSide;                            // y where the top part meets the side wall (x = c)
  const T = spec.top, rt = spec.rt ?? 0.3;
  if (T.type === 'flat') {
    const yt = -H / 2; line(0, yt, c - rt, yt); arc(c - rt, yt + rt, rt, -PI / 2, 0); ytSide = yt + rt;
  } else if (T.type === 'dome') {
    const R = T.R, yc = -H / 2 + R, d = R - rt, fx = c - rt, fy = yc - Math.sqrt(d * d - fx * fx);
    const tx = fx * R / d, ty = yc + (fy - yc) * R / d;
    arc(0, yc, R, -PI / 2, ang(tx, ty, 0, yc)); arc(fx, fy, rt, ang(tx, ty, fx, fy), 0); ytSide = fy;
  } else if (T.type === 'chamfer') {
    const yt = -H / 2; line(0, yt, c - T.dx, yt); line(c - T.dx, yt, c, yt + T.dy); ytSide = yt + T.dy;
  } else if (T.type === 'concave') {   // hollow top (P3): rim = fillet circles touching y=-H/2, concave arc tangent to them
    const R = T.R, fx = c - rt, fy = -H / 2 + rt, yc = fy - Math.sqrt((R + rt) ** 2 - fx * fx);
    const tx = fx * R / (R + rt), ty = yc + (fy - yc) * R / (R + rt);
    arc(0, yc, R, PI / 2, ang(tx, ty, 0, yc));                 // concave arc: lowest point at x=0
    const a0 = ang(tx, ty, fx, fy);                            // fillet over the rim to the side: sweep a0 -> 0 through -PI/2
    let da = 0 - a0; while (da <= 0) da += 2 * PI; while (da > 2 * PI) da -= 2 * PI;
    const n = Math.max(2, Math.ceil(Math.abs(da) * rt / step));
    for (let k = 0; k < n; k++) { const a = a0 + da * k / n; right.push([fx + rt * Math.cos(a), fy + rt * Math.sin(a)]); }
    ytSide = fy;
  } else throw new Error('unknown top ' + T.type);

  // ---- inner ----
  const I = spec.inner; let ri = spec.ri ?? 0.4; let wall;
  if (I.type === 'slope') {
    const ys = ytSide + I.wall, R = I.R, yc = H / 2 - R, xe = c - I.dx, ye = yc + Math.sqrt(R * R - xe * xe);
    line(c, ytSide, c, ys); line(c, ys, xe, ye); arc(0, yc, R, ang(xe, ye, 0, yc), PI / 2); wall = I.wall; ri = 0;
  } else {
    const sideY = (r) => {
      if (I.type === 'flat') return H / 2 - r;
      const R = I.R, yc = H / 2 - R, d = R - r, fx = c - r; return yc + Math.sqrt(d * d - fx * fx);
    };
    if (sideY(ri) < ytSide) {            // no room for the nominal fillet -> shrink it until the wall is exactly 0
      let lo = 0, hi = ri; for (let k = 0; k < 60; k++) { const m = (lo + hi) / 2; if (sideY(m) < ytSide) hi = m; else lo = m; } ri = lo;
    }
    const ybSide = sideY(ri); wall = ybSide - ytSide; line(c, ytSide, c, ybSide);
    if (I.type === 'flat') { arc(c - ri, H / 2 - ri, ri, 0, PI / 2); line(c - ri, H / 2, 0, H / 2); }
    else {
      const R = I.R, yc = H / 2 - R, d = R - ri, fx = c - ri, fy = ybSide, tx = fx * R / d, ty = yc + (fy - yc) * R / d;
      arc(fx, fy, ri, 0, ang(tx, ty, fx, fy)); arc(0, yc, R, ang(tx, ty, 0, yc), PI / 2);
    }
  }
  right.push([0, H / 2]);
  // mirror + convert to z (height above finger line)
  const left = right.slice(0, -1).reverse().map(([x, y]) => [-x, y]);
  const points = right.concat(left.slice(1)).map(([x, y]) => [x, H / 2 - y]);
  return { points, wall, riUsed: ri };
}

// ---------------------------------------------------------------------------------------------
// Profile rules (measured). R from depth ("sagitta") s over the full width: R = (c^2 + s^2) / (2 s), c = W/2.
// ---------------------------------------------------------------------------------------------
const Rs = (c, s) => (c * c + s * s) / (2 * s);
const domeR = (c, s) => Math.max(Rs(c, s), c * 1.01);           // a dome can never be deeper than a half-circle

// Measured lookup data for table-driven profiles (W -> value). Values between measured widths are interpolated (ESTIMATED).
const TAB = {
  // P7/P8 slope (dx, dy) by width
  slope78: { 2: [0.34, 0.27], 3: [0.51, 0.41], 5: [0.86, 0.45], 8: [1.29, 0.50], 12: [1.47, 0.57] },
  // P15–P24: top dome radius by width (independent of H), inner dome radius by width at H = 1.5 / 2.0 / 2.5 (mm)
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
  // inner dome R measured at W = 5 for other heights (used to scale the inner depth with H; ESTIMATED for other widths)
  at5: { P15: { 1.2: 10, 1.5: 10, 2: 10 }, P16: { 1: 25, 1.2: 10, 1.5: 10, 2: 10 }, P17: { 1.2: 17, 1.5: 12, 2: 12 },
         P18: { 1.5: 10, 2: 10, 2.5: 10 }, P19: { 1.2: 9, 1.5: 9, 2: 9 }, P20: { 1.2: 14, 1.5: 9, 2: 9 }, P21: { 1.2: 14, 1.5: 9, 2: 9 },
         P22: { 1.2: 10, 1.5: 8, 2: 8 }, P23: { 1.2: 11, 1.5: 5.5, 2: 5.5 }, P24: { 1.2: 17, 1.5: 7.5, 2: 6 } },
  P13dx: { 1.5: 0.46, 2: 0.585, 2.5: 0.63 },                    // P13 inner chamfer width by H (≈ independent of W)
  P14dx: { 1.5: 0.447, 2: 0.514, 2.5: 0.565 },                  // P14 inner chamfer width by H (≈ independent of W)
};
// interpolate a dome *depth* between measured widths, return radius at width W
function interpR(table, W) {
  const ws = Object.keys(table).map(Number).sort((a, b) => a - b);
  const sOf = (w) => { const c = w / 2, R = table[w]; return R - Math.sqrt(Math.max(0, R * R - c * c)); };
  if (W <= ws[0]) return domeR(W / 2, sOf(ws[0]));
  if (W >= ws[ws.length - 1]) return domeR(W / 2, sOf(ws[ws.length - 1]));
  for (let i = 0; i < ws.length - 1; i++) if (W >= ws[i] && W <= ws[i + 1]) {
    if (W === ws[i]) return table[ws[i]];
    const t = (W - ws[i]) / (ws[i + 1] - ws[i]); return domeR(W / 2, sOf(ws[i]) * (1 - t) + sOf(ws[i + 1]) * t);
  }
}
function interpPair(table, W) {
  const ws = Object.keys(table).map(Number).sort((a, b) => a - b);
  if (W <= ws[0]) return table[ws[0]]; if (W >= ws[ws.length - 1]) return table[ws[ws.length - 1]];
  for (let i = 0; i < ws.length - 1; i++) if (W >= ws[i] && W <= ws[i + 1]) {
    const t = (W - ws[i]) / (ws[i + 1] - ws[i]); return table[ws[i]].map((v, k) => v * (1 - t) + table[ws[i + 1]][k] * t);
  }
}
// inner dome radius for table profiles: depth at (W, 1.5) interpolated over W, scaled by the depth ratio measured at W = 5
function innerR(t, at5, W, H) {
  if (H >= 2.4 && W >= 11.5 && t.inner25) return t.inner25[12];
  const c = W / 2, sOf = (R, cc) => R - Math.sqrt(Math.max(0, R * R - cc * cc));
  const base = interpR(t.inner, W); let s = sOf(base, c);
  if (at5) {
    const hs = Object.keys(at5).map(Number).sort((a, b) => a - b);
    const s5 = (h) => sOf(at5[h], 2.5); const ref = at5[1.5] ? s5(1.5) : s5(hs[0]);
    let k;
    if (H <= hs[0]) k = s5(hs[0]) / ref; else if (H >= hs[hs.length - 1]) k = s5(hs[hs.length - 1]) / ref;
    else for (let i = 0; i < hs.length - 1; i++) if (H >= hs[i] && H <= hs[i + 1]) { const u = (H - hs[i]) / (hs[i + 1] - hs[i]); k = (s5(hs[i]) * (1 - u) + s5(hs[i + 1]) * u) / ref; }
    s *= k;
  }
  return domeR(c, s);
}
const nearestKey = (obj, v) => Object.keys(obj).map(Number).reduce((a, b) => Math.abs(b - v) < Math.abs(a - v) ? b : a);

export function wamaSpec(id, W, H) {
  const c = W / 2;
  switch (id) {
    case 'P1':  return { source: 'formula', spec: { top: { type: 'flat' }, rt: 0.3, inner: { type: 'flat' }, ri: 0.4 } };
    case 'P2':  return { source: 'formula', spec: { top: { type: 'flat' }, rt: 0.3, inner: { type: 'dome', R: domeR(c, H / 2 - 0.10) }, ri: 0.4 } };
    case 'P3': {
      const s = Math.min(0.45 * H, H - 0.783), R = Rs(c, s);
      // equal fillets that meet on the side with zero wall
      const f = (r) => { const d = R - r, fx = c - r; return (H / 2 - R + Math.sqrt(d * d - fx * fx)) - (-H / 2 + r); };
      let lo = 0.05, hi = Math.min(c, H / 2); for (let k = 0; k < 60; k++) { const m = (lo + hi) / 2; if (f(m) > 0) lo = m; else hi = m; }
      const rt = Math.round(lo * 100) / 100;
      return { source: 'formula', spec: { top: { type: 'concave', R }, rt, inner: { type: 'dome', R }, ri: rt } };
    }
    case 'P4':  return { source: 'fit', spec: { top: { type: 'dome', R: domeR(c, 0.305 * (H - 0.44)) }, rt: 0.3, inner: { type: 'dome', R: domeR(c, 0.695 * (H - 0.44)) }, ri: 0.3 } };
    case 'P5':  return { source: 'formula', spec: { top: { type: 'chamfer', dx: 0.52, dy: 0.52 }, inner: { type: 'dome', R: domeR(c, H / 2 - 0.31) }, ri: 0.4 } };
    case 'P6':  return { source: 'formula', spec: { top: { type: 'chamfer', dx: 0.52, dy: 0.52 }, inner: { type: 'flat' }, ri: H >= 1.2 ? 0.4 : 0.3 } };
    case 'P7': { const [dx, dy] = interpPair(TAB.slope78, W);
      return { source: 'table', spec: { top: { type: 'chamfer', dx, dy }, inner: { type: 'dome', R: innerR(TAB.P7, TAB.P7.innerAt5, W, H) }, ri: 0.4 } }; }
    case 'P8': { const [dx, dy] = interpPair(TAB.slope78, W);
      return { source: 'table', spec: { top: { type: 'chamfer', dx, dy }, inner: { type: 'flat' }, ri: H >= 1.0 ? 0.4 : 0.3 } }; }
    case 'P9':  return { source: 'formula', spec: { top: { type: 'dome', R: domeR(c, 0.42 * H) }, rt: 0.3, inner: { type: 'flat' }, ri: Math.min(c, Math.max(0.4, H / 2 - 0.2)) } };
    case 'P10': return { source: 'formula', spec: { top: { type: 'dome', R: domeR(c, H / 2 - 0.21) }, rt: 0.3, inner: { type: 'dome', R: domeR(c, H / 2 - 0.21) }, ri: 0.3 } };
    case 'P11': return { source: 'formula', spec: { top: { type: 'dome', R: domeR(c, 0.42 * H) }, rt: 0.3, inner: { type: 'flat' }, ri: 0.4 } };
    case 'P12': return { source: H >= 1.5 ? 'fit' : 'table', spec: { top: { type: 'flat' }, rt: 0.8, inner: { type: 'dome', R: H >= 1.5 ? domeR(c, H - 1.15) : 18 * (W / 5) }, ri: 0.4 } };
    case 'P13': return { source: 'formula+table', spec: { top: { type: 'dome', R: domeR(c, H / 2 - 0.612) }, rt: 0.3,
                   inner: { type: 'slope', wall: 0.4, dx: TAB.P13dx[nearestKey(TAB.P13dx, H)], R: Rs(c, 0.263) } } };
    case 'P14': return { source: 'formula+table', spec: { top: { type: 'flat' }, rt: 0.3,
                   inner: { type: 'slope', wall: H / 2 - 0.25, dx: TAB.P14dx[nearestKey(TAB.P14dx, H)], R: Rs(c, 0.263) } } };
    default: {
      const t = TAB[id]; if (!t) throw new Error('unknown profile ' + id);
      const inner = innerR(t, TAB.at5[id], W, H);
      return { source: 'table', spec: { top: { type: 'dome', R: interpR(t.top, W) }, rt: 0.3, inner: { type: 'dome', R: inner }, ri: 0.4 } };
    }
  }
}

// Convenience: section polygon for a Wama profile id.
export function wamaSection(id, W, H, step = 0.01) { const { spec, source } = wamaSpec(id, W, H); return { ...buildSection(W, H, spec, step), source, spec }; }

// Metrics used in the report (thickness at the centre, 0.25 mm from the side, mean = area / width).
export function sectionMetrics(points, W) {
  let A = 0; for (let i = 0; i < points.length; i++) { const [x1, z1] = points[i], [x2, z2] = points[(i + 1) % points.length]; A += x1 * z2 - x2 * z1; }
  A = Math.abs(A) / 2;
  const at = (x) => { const hits = []; for (let i = 0; i < points.length; i++) { const [x1, z1] = points[i], [x2, z2] = points[(i + 1) % points.length];
    if ((x1 - x) * (x2 - x) <= 0 && x1 !== x2) hits.push(z1 + (z2 - z1) * (x - x1) / (x2 - x1)); } return Math.max(...hits) - Math.min(...hits); };
  return { area: A, mean: A / W, tCenter: at(0), tEdge025: at(W / 2 - 0.25) };
}
