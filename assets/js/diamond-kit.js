/*
 * diamond-kit.js — real round-brilliant diamond for the ZS configurator.
 *
 * Replaces the old "vertex-colour + sparkle sprite" stone (decisions #51–#70).
 * Three parts, all independent of the rest of the scene:
 *
 *   1. buildBrilliant(cut)  → exact 57-facet round brilliant as the
 *      intersection of half-spaces (table, 8 star, 8 bezel, 16 upper girdle,
 *      N girdle, 8 pavilion main, 16 lower girdle). Returns a flat-shaded
 *      non-indexed BufferGeometry (girdle radius = 1) AND the facet planes.
 *   2. createDiamondMaterial(THREE, kit) → ShaderMaterial that ray-traces the
 *      light path INSIDE the stone against those same planes: Fresnel at every
 *      facet, total internal reflection, refraction out, 3 IORs (R/G/B) for
 *      dispersion ("fire"). A brilliant is convex, so each bounce is just "the
 *      nearest plane in front of the ray" — no BVH, no extra library.
 *      Pure GLSL math → renders identically on SwiftShader and on a real GPU.
 *   3. buildDiamondEnv(THREE, renderer, preset) → a dedicated SHARP, high-
 *      contrast cube map for the stone only (dark/grey studio + strip lights +
 *      small hot points). The gold keeps its own soft PMREM studio: a diamond
 *      needs hard light sources to show facet contrast (decisions #69/#70).
 *
 * Units: stone local space, girdle radius 1, +Y = table up, girdle top at
 * y = 0. Scale the mesh by (diameter_mm / 2).
 */

export const DEFAULT_CUT = {
  table: 0.57,          // table Ø / girdle Ø
  crownAngle: 34.5,     // deg
  pavilionAngle: 40.75, // deg
  starLength: 0.5,      // 0..1 of table-edge → girdle
  lowerGirdle: 0.77,    // 0..1 of girdle → culet (horizontal)
  girdle: 0.035,        // girdle thickness, × girdle radius
  girdleSides: 32,
};

// ---------------------------------------------------------------- geometry

function v3(x, y, z) { return [x, y, z]; }
function sub(a, b) { return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]; }
function dot(a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }
function cross(a, b) { return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]; }
function norm(a) { const l = Math.hypot(a[0], a[1], a[2]); return [a[0] / l, a[1] / l, a[2] / l]; }
function lerp(a, b, t) { return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]; }

const INTERIOR = [0, -0.15, 0];

function planeFromNormal(n, p, kind) {
  n = norm(n);
  return { n, d: dot(n, p), kind };
}
function planeFrom3(a, b, c, kind) {
  let n = norm(cross(sub(b, a), sub(c, a)));
  let d = dot(n, a);
  if (dot(n, INTERIOR) - d > 0) { n = [-n[0], -n[1], -n[2]]; d = -d; }
  return { n, d, kind };
}

export function brilliantPlanes(cut = DEFAULT_CUT) {
  const c = { ...DEFAULT_CUT, ...cut };
  const R = Math.PI / 180;
  const a = c.crownAngle * R, b = c.pavilionAngle * R;
  const t = c.table, g = c.girdle;
  const c8 = Math.cos(Math.PI / 8);
  const yT = (1 - t) * Math.tan(a);
  const planes = [];

  planes.push(planeFromNormal([0, 1, 0], [0, yT, 0], 'table'));

  const tE = t * c8;                                   // table edge midpoint radius
  const rs = tE + c.starLength * (1 - tE);             // star tip radius
  const ys = Math.tan(a) * (1 - rs * c8);              // star tip height (on bezels)
  const tanS = (yT - ys) / (rs - tE);
  const aS = Math.atan(tanS);

  const lgR = 1 - c.lowerGirdle;                       // lower-girdle tip radius
  const yM = Math.tan(b) * (lgR * c8 - 1) - g;         // …its height (on mains)

  for (let k = 0; k < 8; k++) {
    const phi = k * Math.PI / 4;
    const th = phi + Math.PI / 8;
    const cp = Math.cos(phi), sp = Math.sin(phi), ct = Math.cos(th), st = Math.sin(th);

    // bezel (kite), main azimuth
    planes.push(planeFromNormal([Math.sin(a) * cp, Math.cos(a), Math.sin(a) * sp], [cp, 0, sp], 'bezel'));
    // star, between bezels
    planes.push(planeFromNormal([Math.sin(aS) * ct, Math.cos(aS), Math.sin(aS) * st], [tE * ct, yT, tE * st], 'star'));
    // pavilion main
    planes.push(planeFromNormal([Math.sin(b) * cp, -Math.cos(b), Math.sin(b) * sp], [cp, -g, sp], 'pavilion'));

    const S = v3(rs * ct, ys, rs * st);
    const Gth = v3(ct, 0, st), Gb_th = v3(ct, -g, st);
    const M = v3(lgR * ct, yM, lgR * st);
    for (const side of [0, 1]) {
      const phiN = side === 0 ? phi : phi + Math.PI / 4;
      const Gphi = v3(Math.cos(phiN), 0, Math.sin(phiN));
      const Gb_phi = v3(Math.cos(phiN), -g, Math.sin(phiN));
      planes.push(planeFrom3(S, Gth, Gphi, 'upperGirdle'));
      planes.push(planeFrom3(M, Gb_th, Gb_phi, 'lowerGirdle'));
    }
  }
  for (let i = 0; i < c.girdleSides; i++) {
    const az = (i / c.girdleSides) * Math.PI * 2;
    planes.push(planeFromNormal([Math.cos(az), 0, Math.sin(az)], [Math.cos(az), 0, Math.sin(az)], 'girdle'));
  }
  return { planes, yTable: yT, yCulet: -(Math.tan(b) + g), girdle: g };
}

// Convex polyhedron = box clipped by every half-space n·x <= d.
function clipPolyhedron(planes) {
  const B = 2;
  const box = [
    [[-B, -B, -B], [-B, -B, B], [-B, B, B], [-B, B, -B]],
    [[B, -B, -B], [B, B, -B], [B, B, B], [B, -B, B]],
    [[-B, -B, -B], [B, -B, -B], [B, -B, B], [-B, -B, B]],
    [[-B, B, -B], [-B, B, B], [B, B, B], [B, B, -B]],
    [[-B, -B, -B], [-B, B, -B], [B, B, -B], [B, -B, -B]],
    [[-B, -B, B], [B, -B, B], [B, B, B], [-B, B, B]],
  ];
  let faces = box.map((pts) => ({ pts, plane: null }));
  const EPS = 1e-9;
  for (const pl of planes) {
    const cap = [];
    const next = [];
    for (const f of faces) {
      const out = [];
      const n = f.pts.length;
      for (let i = 0; i < n; i++) {
        const A = f.pts[i], Bp = f.pts[(i + 1) % n];
        const da = dot(pl.n, A) - pl.d, db = dot(pl.n, Bp) - pl.d;
        if (da <= EPS) out.push(A);
        if ((da < -EPS && db > EPS) || (da > EPS && db < -EPS)) {
          const P = lerp(A, Bp, da / (da - db));
          out.push(P); cap.push(P);
        } else if (Math.abs(da) <= EPS) cap.push(A);
      }
      if (out.length >= 3) next.push({ pts: out, plane: f.plane });
    }
    faces = next;
    // order the cap polygon around its centroid
    const uniq = [];
    for (const p of cap) if (!uniq.some((q) => Math.hypot(q[0] - p[0], q[1] - p[1], q[2] - p[2]) < 1e-7)) uniq.push(p);
    if (uniq.length >= 3) {
      const ctr = uniq.reduce((s, p) => [s[0] + p[0], s[1] + p[1], s[2] + p[2]], [0, 0, 0]).map((x) => x / uniq.length);
      const u = norm(sub(uniq[0], ctr));
      const w = cross(pl.n, u);
      uniq.sort((p, q) => Math.atan2(dot(sub(p, ctr), w), dot(sub(p, ctr), u)) - Math.atan2(dot(sub(q, ctr), w), dot(sub(q, ctr), u)));
      faces.push({ pts: uniq, plane: pl });
    }
  }
  // drop degenerate slivers + any leftover box face
  return faces.filter((f) => f.plane && f.pts.length >= 3 && polyArea(f.pts) > 1e-7);
}
function polyArea(pts) {
  let s = [0, 0, 0];
  for (let i = 1; i < pts.length - 1; i++) {
    const c = cross(sub(pts[i], pts[0]), sub(pts[i + 1], pts[0]));
    s = [s[0] + c[0], s[1] + c[1], s[2] + c[2]];
  }
  return Math.hypot(s[0], s[1], s[2]) / 2;
}

/**
 * @returns {{ positions:Float32Array, normals:Float32Array, faceKind:string[],
 *   planes:Float32Array (vec4 xyz=n, w=d, only planes that became real facets),
 *   planeCount:number, facetCount:number, yTable:number, yCulet:number }}
 */
export function buildBrilliant(cut) {
  const info = brilliantPlanes(cut);
  const faces = clipPolyhedron(info.planes);
  const pos = [], nrm = [], kinds = [];
  // Orient every face's winding to its outward plane normal.
  for (const f of faces) {
    const p = f.pts;
    const fn = norm(cross(sub(p[1], p[0]), sub(p[2], p[0])));
    const pts = dot(fn, f.plane.n) < 0 ? [...p].reverse() : p;
    for (let i = 1; i < pts.length - 1; i++) {
      for (const q of [pts[0], pts[i], pts[i + 1]]) { pos.push(...q); nrm.push(...f.plane.n); }
    }
    kinds.push(f.plane.kind);
  }
  const used = faces.map((f) => f.plane);
  const planes = new Float32Array(used.length * 4);
  used.forEach((pl, i) => { planes.set([pl.n[0], pl.n[1], pl.n[2], pl.d], i * 4); });
  const facetCount = kinds.filter((k) => k !== 'girdle').length;
  return {
    positions: new Float32Array(pos), normals: new Float32Array(nrm), faceKind: kinds,
    planes, planeCount: used.length, facetCount, yTable: info.yTable, yCulet: info.yCulet,
  };
}

export function brilliantGeometry(THREE, cut) {
  const b = buildBrilliant(cut);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(b.positions, 3));
  geo.setAttribute('normal', new THREE.BufferAttribute(b.normals, 3));
  geo.computeBoundingSphere();
  geo.userData.brilliant = b;
  return geo;
}

// ---------------------------------------------------------------- material

export const MAX_PLANES = 96;

const VERT = /* glsl */`
  varying vec3 vPos;
  varying vec3 vNrm;
  varying vec3 vCam;
  varying vec3 vM0; varying vec3 vM1; varying vec3 vM2;
  void main() {
    mat4 m = modelMatrix;
    #ifdef USE_INSTANCING
      m = modelMatrix * instanceMatrix;
    #endif
    vPos = position;
    vNrm = normal;
    vCam = (inverse(m) * vec4(cameraPosition, 1.0)).xyz;
    vM0 = normalize(m[0].xyz); vM1 = normalize(m[1].xyz); vM2 = normalize(m[2].xyz);
    gl_Position = projectionMatrix * viewMatrix * m * vec4(position, 1.0);
  }
`;

const FRAG = /* glsl */`
  #define MAXP ${MAX_PLANES}
  #define MAXB 10
  uniform vec4 uPlanes[MAXP];
  uniform int uCount;
  uniform samplerCube uEnv;
  uniform float uEnvIntensity;
  uniform vec3 uIor;          // r, g, b
  uniform int uBounces;
  uniform float uSeatY;       // exits below this (object space) hit the metal seat
  uniform vec3 uSeatColor;
  uniform float uSeatMix;     // 0 = pure env, 1 = pure seat colour below uSeatY
  uniform vec3 uTint;         // body colour (1,1,1 = colourless D)
  uniform float uContrast;    // extra punch on the final value
  varying vec3 vPos;
  varying vec3 vNrm;
  varying vec3 vCam;
  varying vec3 vM0; varying vec3 vM1; varying vec3 vM2;

  vec3 envW(vec3 dObj) {
    vec3 w = normalize(mat3(vM0, vM1, vM2) * dObj);
    return texture(uEnv, w).rgb * uEnvIntensity;
  }
  float fres(float cosi, float ior) {
    float f0 = (ior - 1.0) / (ior + 1.0); f0 *= f0;
    float c = clamp(1.0 - cosi, 0.0, 1.0);
    return f0 + (1.0 - f0) * c * c * c * c * c;
  }
  // light leaving the stone at point p in direction d (object space)
  vec3 outside(vec3 p, vec3 d) {
    vec3 e = envW(d);
    if (p.y < uSeatY) e = mix(e, uSeatColor, uSeatMix);
    return e;
  }
  // follow one wavelength from the entry point to the exits; returns radiance
  vec3 traceInside(vec3 p, vec3 d, float ior) {
    vec3 acc = vec3(0.0);
    float thr = 1.0;
    for (int i = 0; i < MAXB; i++) {
      if (i >= uBounces) break;
      float tmin = 1e9; vec3 nh = vec3(0.0, 1.0, 0.0);
      for (int j = 0; j < MAXP; j++) {
        if (j >= uCount) break;
        vec4 pl = uPlanes[j];
        float dn = dot(pl.xyz, d);
        if (dn > 1e-5) {
          float t = (pl.w - dot(pl.xyz, p)) / dn;
          if (t > 1e-5 && t < tmin) { tmin = t; nh = pl.xyz; }
        }
      }
      p += d * tmin;
      vec3 r = refract(d, -nh, ior);
      if (dot(r, r) < 1e-6) { d = reflect(d, -nh); continue; }   // total internal reflection
      float F = fres(dot(d, nh), ior);
      acc += thr * (1.0 - F) * outside(p, r);
      thr *= F;
      d = reflect(d, -nh);
    }
    acc += thr * outside(p, d) * 0.6;   // energy left after the last bounce
    return acc;
  }
  void main() {
    vec3 n = normalize(vNrm);
    vec3 d0 = normalize(vPos - vCam);
    float cosi = clamp(-dot(d0, n), 0.0, 1.0);
    float F = fres(cosi, uIor.g);
    vec3 refl = envW(reflect(d0, n));
    vec3 col;
    if (abs(uIor.r - uIor.b) < 1e-4) {
      vec3 dt = refract(d0, n, 1.0 / uIor.g);
      col = traceInside(vPos, dt, uIor.g);
    } else {
      col.r = traceInside(vPos, refract(d0, n, 1.0 / uIor.r), uIor.r).r;
      col.g = traceInside(vPos, refract(d0, n, 1.0 / uIor.g), uIor.g).g;
      col.b = traceInside(vPos, refract(d0, n, 1.0 / uIor.b), uIor.b).b;
    }
    col = F * refl + (1.0 - F) * col * uTint;
    col = pow(max(col, 0.0), vec3(uContrast));
    gl_FragColor = vec4(col, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

export function iorTriplet(dispersion) {
  // diamond: nC 2.407 / nD 2.417 / nF 2.451 — spread scaled by `dispersion`
  const g = 2.417;
  const s = 0.022 * dispersion;
  return [g - s, g, g + s];
}

export function createDiamondMaterial(THREE, brilliant, envTexture, params = {}) {
  const planes = [];
  for (let i = 0; i < MAX_PLANES; i++) {
    const o = i * 4;
    planes.push(i < brilliant.planeCount
      ? new THREE.Vector4(brilliant.planes[o], brilliant.planes[o + 1], brilliant.planes[o + 2], brilliant.planes[o + 3])
      : new THREE.Vector4(0, 1, 0, 100));
  }
  const p = {
    envIntensity: 1.0, dispersion: 1.0, bounces: 6, seatMix: 0.85,
    seatColor: 0x6b4f1c, tint: 0xffffff, contrast: 1.0, ...params,
  };
  const ior = iorTriplet(p.dispersion);
  const mat = new THREE.ShaderMaterial({
    uniforms: {
      uPlanes: { value: planes },
      uCount: { value: brilliant.planeCount },
      uEnv: { value: envTexture },
      uEnvIntensity: { value: p.envIntensity },
      uIor: { value: new THREE.Vector3(...ior) },
      uBounces: { value: p.bounces },
      uSeatY: { value: 0.001 },
      uSeatColor: { value: new THREE.Color(p.seatColor) },
      uSeatMix: { value: p.seatMix },
      uTint: { value: new THREE.Color(p.tint) },
      uContrast: { value: p.contrast },
    },
    vertexShader: VERT,
    fragmentShader: FRAG,
  });
  mat.userData.setDispersion = (k) => { mat.uniforms.uIor.value.set(...iorTriplet(k)); };
  return mat;
}

// ------------------------------------------------------ diamond environment

export const ENV_PRESETS = {
  // head: the viewer/camera silhouette straight above the stone (what gives a
  // real brilliant its dark "arrows" when seen face-up). headLum = its brightness.
  kontrast: { base: 0.18, floor: 0.45, strips: 12, strip: 7.0, points: 80, point: 28, dark: 5, head: 4.5, headLum: 0.0 },
  svetlo:   { base: 0.60, floor: 0.95, strips: 10, strip: 5.0, points: 60, point: 20, dark: 6, head: 5.0, headLum: 0.08 },
  tamno:    { base: 0.04, floor: 0.14, strips: 14, strip: 9.0, points: 100, point: 34, dark: 0, head: 6.0, headLum: 0.0 },
};

// deterministic pseudo-random so every build of the studio is identical
function rng(seed) { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }

export function buildDiamondEnv(THREE, renderer, presetKey = 'kontrast', size = 512) {
  const P = ENV_PRESETS[presetKey] || ENV_PRESETS.kontrast;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(P.base, P.base, P.base * 1.02);
  const rand = rng(7);
  const addQuad = (w, h, pos, inten, color = [1, 1, 1]) => {
    const m = new THREE.Mesh(
      new THREE.PlaneGeometry(w, h),
      new THREE.MeshBasicMaterial({ color: new THREE.Color(color[0] * inten, color[1] * inten, color[2] * inten), side: THREE.DoubleSide, toneMapped: false }),
    );
    m.position.copy(pos); m.lookAt(0, 0, 0); scene.add(m);
    return m;
  };
  const sph = (r, el, az) => new THREE.Vector3(r * Math.cos(el) * Math.cos(az), r * Math.sin(el), r * Math.cos(el) * Math.sin(az));
  // floor / lower hemisphere: grey card (metal + table surroundings)
  addQuad(60, 60, new THREE.Vector3(0, -10, 0), P.floor);
  // long strip softboxes around the upper hemisphere
  for (let i = 0; i < P.strips; i++) {
    const az = (i / P.strips) * Math.PI * 2 + rand() * 0.3;
    const el = 0.35 + rand() * 0.9;
    addQuad(1.2 + rand() * 1.2, 5 + rand() * 4, sph(12, el, az), P.strip * (0.6 + rand() * 0.6));
  }
  // dark flags (black cards) — the "black" that makes a stone read as a diamond
  for (let i = 0; i < P.dark; i++) {
    const az = rand() * Math.PI * 2, el = 0.2 + rand() * 1.1;
    addQuad(4 + rand() * 4, 4 + rand() * 4, sph(11, el, az), 0.0);
  }
  // many small hot points = scintillation; a few faintly warm/cool
  for (let i = 0; i < P.points; i++) {
    const az = rand() * Math.PI * 2, el = -0.1 + rand() * 1.25;
    const s = 0.12 + rand() * 0.22;
    const tint = rand() < 0.2 ? [1, 0.93, 0.85] : rand() < 0.2 ? [0.88, 0.94, 1] : [1, 1, 1];
    addQuad(s, s, sph(12, el, az), P.point * (0.5 + rand()), tint);
  }
  // viewer's head / camera above the stone — dark disc at the zenith
  const head = new THREE.Mesh(new THREE.CircleGeometry(P.head, 48), new THREE.MeshBasicMaterial({ color: new THREE.Color(P.headLum, P.headLum, P.headLum), side: THREE.DoubleSide, toneMapped: false }));
  head.position.set(0, 11.5, 0); head.lookAt(0, 0, 0); scene.add(head);

  const rt = new THREE.WebGLCubeRenderTarget(size, { type: THREE.HalfFloatType, generateMipmaps: false });
  const cam = new THREE.CubeCamera(0.1, 100, rt);
  const prevTM = renderer.toneMapping;
  renderer.toneMapping = THREE.NoToneMapping;
  cam.update(renderer, scene);
  renderer.toneMapping = prevTM;
  scene.traverse((o) => { if (o.isMesh) { o.geometry.dispose(); o.material.dispose(); } });
  return rt;
}
