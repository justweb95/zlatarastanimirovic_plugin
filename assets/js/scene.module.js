/*
 * ZS Configurator — real-time 3D scene (Faza 2 + premium-look pass).
 *
 * Procedural wedding band: a cross-section profile revolved around the finger
 * axis (LatheGeometry). Driven live by width / thickness / size / profile.
 * Metal = LUT look (Faza 2 look update, see "LUT metal look" below): our
 * grayscale studio-v3 cube indexes a per-metal gradient LUT, unlit and
 * untouched by tone mapping. Stones still use PBR with studio reflections
 * via RoomEnvironment (its 6 decorative "furniture" boxes stripped out in
 * buildStudio() below; the room walls + its 6 real area lights stay) +
 * PMREM as scene.environment. frameloop = "demand".
 *
 * Two rendering modes, chosen at create():
 *  - opts.pair = true  → the main viewport. Renders BOTH rings ("her"/"his")
 *    simultaneously, tilted and offset into a jewelry-photography pair pose
 *    (see POSE below), like the competitor references (docs/reference/
 *    competitors.md), instead of one ring shown flat/top-down at a time.
 *  - opts.pair falsy   → a single centred ring, still tilted the same way.
 *    Used for the left-hand model-list thumbnails (configurator.js renders
 *    each model into a small hidden scene of this kind).
 *
 * Interaction: standard OrbitControls — dragging orbits the camera around
 * the pair (with damping), wheel/rail buttons dolly in and out. (A turntable
 * variant — fixed camera/lights, drag spins the pair instead — was tried and
 * felt unnatural, so this reverted back to camera-orbit; only the pose
 * separation / seam-weld / framing fixes from that pass were kept.)
 *
 * setState() accepts either a single ring-state object (legacy / thumbnail
 * use — rendered as "her") or a pair `{ her, his }` (main viewport).
 *
 * three.js is bundled locally (assets/lib/three) and resolved through the import
 * map printed by the shortcode. No build step yet — the Svelte/Vite migration
 * (Faza 2b) will replace the UI shell, not this module.
 *
 * Exposes window.ZSCScene.create(canvas, opts) → { setState, resize, dispose,
 * screenshot, zoom, reset, setAutoRotate }. The classic UI script
 * (configurator.js) calls it once the `zsc:scene-ready` event has fired.
 */
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { buildBrilliant, createDiamondMaterial, buildDiamondEnv, iorTriplet } from 'zsc/diamond-kit';

// Pose of each ring in "pair" mode, tuned live via the ?zscdebug=1 panel
// (Round 8, 2026-09-05) — resolves the earlier "her 30° relative to his"
// open question: both rings now share the same yaw and are told apart by a
// small roll (rotation.z) + offset difference instead. `rot` is Euler
// (x,y,z) radians; `off` is a Vector3 scaled by that ring's own outer
// radius, EXCEPT `off.y`, which is an additive lift ABOVE strict ground
// contact (see buildBandFor/contactPoint below) rather than a raw position —
// every ring still starts glued to the floor via its actual lowest vertex
// (accounts for lean/roll, not just a bounding-box guess) before that lift
// is added, so it can never float or clip regardless of size/pose.
const POSE = {
  // Round 17-18 (2026-09-16): client re-tuned the pair pose live via
  // ?zscdebug=1 on their own machine and sent the exported JSON, twice —
  // "her" refined further the second time (rot.x/y/z and off.x/z all
  // nudged); "his" unchanged since Round 17.
  her: {
    rot: new THREE.Euler(-0.6632251157578453, 0.05235987755982989, 1.6231562043547265),
    off: new THREE.Vector3(0.9, 0, -0.41),
  },
  his: {
    rot: new THREE.Euler(0, -0.10471975511965978, 1.5707963267948966),
    off: new THREE.Vector3(0, 0, 0),
  },
};
const ZERO = new THREE.Vector3(0, 0, 0);

// ------------------------------------------------------------ LUT metal look
//
// Faza 2 (2026-10-01, faza2/PROMPT-CLAUDE-CODE.md): polished metal is no
// longer PBR. Per pixel: the camera reflection (per VERTEX — MeshBasic's
// vReflect, no normal map) reads our grayscale studio cube (assets/env/
// studio-v3, 6 × 512² JPG, raw 0..1 values), and that gray value indexes a 1D
// gradient LUT per metal (black → metal hues → white). Output goes to the
// screen with no lights, no tone mapping, no sRGB conversion — the metal is
// fully isolated from the renderer's ACES/sRGB settings (which the stones
// still use). Mat/Grebano finishes cross-fade to the blurred cube
// (studio-v3-blur) instead of raising roughness.
//
// LUT stops = measured gradients (faza2/reference/wama-lut-stops.json), 65
// stops per metal at rows 0,8,…,504,511 of a 512 ramp (t = row/511), packed
// here as concatenated RRGGBB. Do not tweak these to "fix" brightness — the
// environment is what's calibrated (see ?calib=1 below).
const LUT_STOPS = {
  yellow: '0000000601010903020e05031306031908051e0a05220d07280e092f120a34140d3a180e411a10471e124c2313522815582e175e3419633a1b6a421f7048207750237f5725865d288e642a956b2d9d722fa47932ab8035b18639b78d3bbc923fc09841c49d45c9a14acca64dd0ab53d4b058d7b45edbb964dfbd6be1c172e3c578e6ca81e9ce88ead08eedd497efd89df1dba5f2deabf3e1b3f5e4b9f6e6bff8e8c7f9ebcffaeed3faf1dbfbf3e0fbf5e6fcf7eafdf9effdfaf4fefcf8fefdfcffffff',
  red: '0401010603030a0404100706140a09180d0c1e100d25140f2a16112f1913341d16391f173f221846261a4b281c512c1e562e205d31206533206e36217639237c3b24833e268a412790432995482c9a4c2f9e5032a15435a2583aa65c3eaa6140ae6344b56746b96a49bd704dc1744fc37955c57d5ac8825fcb8662cf8a65d28e6ad59570d89976da9d7bdca381dfa885e2ad8ae5b190e6b798e8bc9feac0a4ecc6abefcab0f2d1b8f3d5bdf6d9c5f7dfccfae4d5fae9dcfbeee4fcf4edfef8f5fffcf9',
  white: '0201010404040808070d0b0a120f0e1513121a18171e1d1c2421202726252b2a2a302f303533343a3839403e3d4543434b47474f4c4c55504f5956525d5a57625d5a66625e6a65626d6a65716d6976706d7975707e7874817b77867f7b8a837f8e8782928b86968f899a938e9d9792a19b97a79f9aa9a49fada7a3b2aba8b4b0adb8b4b1bdb9b6c1bdbac5c1bec8c5c3ccc9c8d1cdcbd4d0cfd7d5d3dbd9d7dfdddbe2e0dfe5e4e3e9e7e6ebebeaeeeeecf1f0eff4f3f2f7f6f6fafaf9fdfbfcfefefd',
  manganese: '0101010404050708090b0b0d100f1113131717171b1b1b1e2020242626292b2c3031323736363c3c3e4243454a494b4f4f505657585c5c5e6062636668696b6c6c727272757777797c797e7f7d7f8382848887898b8a8f90909294949899989b9e9c9fa1a0a2a5a4a7aaa9aaaeadafb3b1b3b7b4b6bababbbebcbec2c1c1c7c3c6cac9c9cdccccd0d0d1d3d3d5d7d5d7d9d8d9dadadcdddddfe0e0e2e2e2e4e5e5e6e7e7e9eaeaebececedefeff0f2f2f2f4f4f4f6f6f6f9f9f9fbfbfbfdfdfdfefefe',
  'white-pd': '0201020202020606060a090a0d0c0c1010101413131817171a1a1a1e1e1e2221222525252929292d2c2c3030303434333837373b3a3a3f3d3d4342414745454a48474e4c4b52504f5554525a57565e5b5a625f5d6663626865646c6967706d6c7471707875757c7979817f7e8583828987868d8b8a918f8e9593929a97969f9c9ca3a1a0a7a5a5aba9a9afadadb5b3b2b9b7b7bdbbbbc1c0bfc7c4c4cbc9c9cfcecdd3d1d0d8d5d5dddbdbe1dfdfe5e3e3e8e8e7edececf2f2f1f7f6f5fafaf9fcfcfb',
};
// Material option slug (wp_zs_options, group "material") → LUT. A slug with
// no entry falls back to yellow with a console warning.
const METAL_LUT = { zuto: 'yellow', crveno: 'red', roze: 'red', belo: 'white', paladijum: 'white-pd' };
const LUT_SIZE = 512;
// Flush-set stone seats cut into the band per ring (diamond v2, decisions #73).
const MAX_HOLES = 8;
// Finishes rougher than this read the blurred studio (Mat 0.42, Grebano 0.34;
// Polirano 0.06).
const BLUR_ROUGHNESS = 0.2;

function lutStops(packed) {
  const stops = [];
  for (let i = 0; i < packed.length / 6; i++) {
    const n = parseInt(packed.substr(i * 6, 6), 16);
    stops.push([Math.min(i * 8, 511) / 511, [(n >> 16) & 255, (n >> 8) & 255, n & 255]]);
  }
  return stops;
}

// 1 × 512 ramp, raw display values (NoColorSpace), linear filtered, no mips.
function createLutTexture(stops) {
  const data = new Uint8Array(LUT_SIZE * 4);
  let k = 0;
  for (let i = 0; i < LUT_SIZE; i++) {
    const t = i / (LUT_SIZE - 1);
    while (k < stops.length - 2 && stops[k + 1][0] < t) k++;
    const [t0, a] = stops[k];
    const [t1, b] = stops[k + 1];
    const f = Math.min(1, Math.max(0, (t - t0) / ((t1 - t0) || 1)));
    for (let c = 0; c < 3; c++) data[i * 4 + c] = Math.round(a[c] + (b[c] - a[c]) * f);
    data[i * 4 + 3] = 255;
  }
  const tex = new THREE.DataTexture(data, 1, LUT_SIZE, THREE.RGBAFormat);
  tex.colorSpace = THREE.NoColorSpace;
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.generateMipmaps = false;
  tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.needsUpdate = true;
  return tex;
}

// Built once per page, shared by every scene instance (three.js keeps GPU
// copies per renderer, the CPU-side objects can be shared).
let lutCache = null;
function getLuts() {
  if (!lutCache) {
    lutCache = {};
    Object.keys(LUT_STOPS).forEach((k) => { lutCache[k] = createLutTexture(lutStops(LUT_STOPS[k])); });
    // Identity ramp (black → white) for the ?calib=1 brightness distribution.
    lutCache.identity = createLutTexture([[0, [0, 0, 0]], [1, [255, 255, 255]]]);
  }
  return lutCache;
}
// Metal tint the diamond picks up through its pavilion (diamond-kit
// uSeatColor): LUT colour at t = 0.55 — about where the old flat PBR metal
// colour sat on the ramp — × 0.55 like before, in linear (working) space.
function seatColorFor(lut) {
  if (!lut.userData.seatColor) {
    const i = Math.round(0.55 * (LUT_SIZE - 1)) * 4, d = lut.image.data;
    lut.userData.seatColor = new THREE.Color().setRGB(d[i] / 255, d[i + 1] / 255, d[i + 2] / 255, THREE.SRGBColorSpace).multiplyScalar(0.55);
  }
  return lut.userData.seatColor;
}
function lutFor(slug) {
  const luts = getLuts();
  const key = METAL_LUT[slug];
  if (!key && slug) console.warn('[zsc] no LUT for metal "' + slug + '", using yellow');
  return luts[key || 'yellow'];
}

// Grayscale studio cubes, read as a luminance INDEX (never as light). URL is
// resolved relative to this module (assets/js/ → assets/env/), so it follows
// ZSC_URL like every other plugin asset. Shipped byte-exact — never re-encode
// these JPGs (any level change shifts the whole metal look).
const ENV_BASE = new URL('../env/', import.meta.url);
let envCache = null;
function getEnvs() {
  if (envCache) return envCache;
  const waiters = [];
  let pending = 2;
  const done = () => { if (--pending === 0) { envCache.ready = true; waiters.splice(0).forEach((fn) => fn()); } };
  const load = (dir) => {
    const tex = new THREE.CubeTextureLoader()
      .setPath(new URL(dir + '/', ENV_BASE).href)
      .load(['px.jpg', 'nx.jpg', 'py.jpg', 'ny.jpg', 'pz.jpg', 'nz.jpg'], done, undefined,
        () => { console.error('[zsc] failed to load env ' + dir); done(); });
    tex.colorSpace = THREE.NoColorSpace;
    tex.generateMipmaps = true;
    tex.minFilter = THREE.LinearMipmapLinearFilter;
    tex.magFilter = THREE.LinearFilter;
    return tex;
  };
  envCache = {
    sharp: load('studio-v3'), blur: load('studio-v3-blur'), ready: false,
    onReady(fn) { if (envCache.ready) fn(); else waiters.push(fn); },
  };
  return envCache;
}

// The metal material. One per ring (her/his can be different metals), all
// sharing one compiled program (customProgramCacheKey); switching metal or
// finish only changes uniforms — never a recompile.
//   uLut / uLutPrev / uLutMix — current + previous LUT, cross-faded on switch
//   uLutB / uLutC + uZoneCount / uStop1 / uStop2 — "Dve boje"/"Tri boje"
//     zones (per-vertex aBandY = local width-axis position, see buildBandFor)
//   uEnvBlur / uBlurMix — blurred studio for Mat/Grebano, cross-faded
//   uHoles / uHoleZ / uHoleCount — flush stone seats (diamond v2): per hole
//     vec4(axis.x, axis.z, widthPos, radius) in band-local space + the radial
//     depth below which nothing is cut; the fragment is discarded inside
// `shared` = another metal material's userData.lut, so the stone seat wall
// follows its band's LUT/zones/cross-fades (it gets its own uBlurMix).
function createLutMetalMaterial(env, shared) {
  const luts = getLuts();
  const u = shared ? { ...shared, uBlurMix: { value: shared.uBlurMix.value } } : {
    uLut: { value: luts.yellow },
    uLutPrev: { value: luts.yellow },
    uLutMix: { value: 1 },
    uLutB: { value: luts.yellow },
    uLutC: { value: luts.yellow },
    uZoneCount: { value: 0 },
    uStop1: { value: 0 },
    uStop2: { value: 0 },
    uEnvBlur: { value: env.blur },
    uBlurMix: { value: 0 },
  };
  const holes = {
    uHoleCount: { value: 0 },
    uHoles: { value: Array.from({ length: MAX_HOLES }, () => new THREE.Vector4()) },
    uHoleZ: { value: new Array(MAX_HOLES).fill(1e6) },
  };
  const m = new THREE.MeshBasicMaterial({
    color: 0xffffff, envMap: env.sharp, combine: THREE.MultiplyOperation, reflectivity: 1,
    side: THREE.DoubleSide,
  });
  m.toneMapped = false;
  m.userData.lut = u;
  m.userData.holes = holes;
  m.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, u, holes);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float aBandY;\nvarying float vBandY;\nvarying vec3 vBandLocal;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvBandY = aBandY;\nvBandLocal = position;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying float vBandY;\n'
        + 'uniform sampler2D uLut;\nuniform sampler2D uLutPrev;\nuniform float uLutMix;\n'
        + 'uniform sampler2D uLutB;\nuniform sampler2D uLutC;\n'
        + 'uniform float uZoneCount;\nuniform float uStop1;\nuniform float uStop2;\n'
        + 'uniform samplerCube uEnvBlur;\nuniform float uBlurMix;\n'
        + 'varying vec3 vBandLocal;\nuniform int uHoleCount;\nuniform vec4 uHoles[' + MAX_HOLES + '];\nuniform float uHoleZ[' + MAX_HOLES + '];')
      .replace('void main() {',
        'void main() {\n  for (int i = 0; i < ' + MAX_HOLES + '; i++) {\n    if (i >= uHoleCount) break;\n'
        + '    vec4 h = uHoles[i];\n    float sAx = vBandLocal.x * h.x + vBandLocal.z * h.y;\n'
        + '    vec3 q = vBandLocal - vec3(h.x * sAx, h.z, h.y * sAx);\n'
        + '    if (sAx > uHoleZ[i] && dot(q, q) < h.w * h.w) discard;\n  }')
      .replace('#include <opaque_fragment>', `#include <opaque_fragment>
        float envV = gl_FragColor.r;
        if ( uBlurMix > 0.001 ) {
          float envB = textureCube( uEnvBlur, envMapRotation * vec3( flipEnvMap * vReflect.x, vReflect.yz ) ).r;
          envV = mix( envV, envB, uBlurMix );
        }
        vec2 lutUv = vec2( 0.5, ( clamp( envV, 0.0, 1.0 ) * 511.0 + 0.5 ) / 512.0 );
        vec3 lutC;
        if ( uZoneCount > 1.5 ) {
          lutC = ( vBandY > uStop1 ) ? texture2D( uLutB, lutUv ).rgb : texture2D( uLut, lutUv ).rgb;
          if ( uZoneCount > 2.5 && vBandY > uStop2 ) lutC = texture2D( uLutC, lutUv ).rgb;
        } else {
          lutC = texture2D( uLut, lutUv ).rgb;
          if ( uLutMix < 0.999 ) lutC = mix( texture2D( uLutPrev, lutUv ).rgb, lutC, uLutMix );
        }
        gl_FragColor.rgb = lutC;`)
      .replace('#include <colorspace_fragment>', ''); // LUT values are already display values
  };
  m.customProgramCacheKey = () => 'zsc-lut-metal-v2';
  return m;
}

// LatheGeometry doesn't share vertices between its first and last angular
// ring (phi=0 vs phi=2π close back onto the same position) — so
// computeVertexNormals() treats them as unrelated and the lit result can show
// a visible crease running down the band where the revolve closes.
//
// Round 13 (2026-09-15, client screenshot: a hard "kink" on the inner-top rim
// edge, right where the two red-circled screenshots showed it): this used to
// be "fixed" by averaging the seam pair's two independently-computed normals
// after the fact (see git history for the old weldLatheSeam). That worked for
// the smoothly-curved rows, but broke down exactly on a sharp cross-section
// corner (flat profile's inner-top edge, where the inner wall meets the top
// face) — averaging two one-sided corner blends isn't the same as actually
// blending both sides at once, and measured ~12° off from the ring's normal
// ~1.4°/segment elsewhere (9×). Real fix: merge the seam TOPOLOGICALLY, in
// the index buffer, BEFORE computeVertexNormals() ever runs, so seam vertices
// pick up faces from both sides like every other ring does — no separate
// post-hoc averaging step needed, and it stays correct even after
// carveGroovesIntoGeometry's own computeVertexNormals() re-run.
function mergeLatheSeamIndices(geo, rows, segments) {
  const idx = geo.index;
  if (!idx) return;
  const arr = idx.array;
  const seamStart = segments * rows; // ring `segments`, row 0's vertex index
  for (let k = 0; k < arr.length; k++) {
    if (arr[k] >= seamStart) arr[k] -= seamStart; // ring `segments` → ring 0 (same row)
  }
  idx.needsUpdate = true;
}

// Faza 2: min 2 even at DPR 1 (the LUT look lives in thin chamfer lines),
// max 3.
function viewPixelRatio() {
  return Math.min(3, Math.max(2, window.devicePixelRatio || 1));
}

function create(canvas, opts = {}) {
  const pairMode = !!opts.pair;
  const host = canvas.parentElement;
  const renderer = new THREE.WebGLRenderer({
    canvas, antialias: true, alpha: true, powerPreference: 'high-performance',
  });
  renderer.setPixelRatio(viewPixelRatio());
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.08;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.setClearAlpha(0);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();

  // Client: the studio's light panels were flat hard-edged rectangles — on a
  // near-mirror metal (roughness 0.08) that reflects back as sharp little
  // "boxes" sitting on the ring instead of a soft photographic glow. A
  // radial-gradient texture on the same panels turns each into a soft round
  // reflector (like a real octabox/beauty dish) with no hard edge to catch.
  function makeGlowTexture() {
    const s = 128;
    const c = document.createElement('canvas');
    c.width = c.height = s;
    const ctx = c.getContext('2d');
    const g = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.6, 'rgba(255,255,255,0.6)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, s, s);
    return new THREE.CanvasTexture(c);
  }
  const glowTex = makeGlowTexture();

  // Studio environment: RoomEnvironment's room+lights (its furniture boxes
  // stripped in buildStudio()) + our own bright floor + 3 soft round
  // reflectors, PMREM-filtered. Kept mutable (studioParams) + rebuildable
  // (rebuildEnvironment(), near the debug API below) so the ?zscdebug=1
  // "Odsjaj" panel can live-tune WHERE the shine sits on the metal and how
  // bright it is. `envTiltX`/`envOffsetY` transform the WHOLE baked
  // environment (room + floor + reflectors together) — rotate/translate it
  // — before baking, rather than the ring itself. Client specifically asked
  // for "height WITHIN the studio", as distinct from and NOT to be confused
  // with the ring's actual world/ground position (that stays exactly where
  // buildBandFor's ground-levelling puts it — untouched by this). Since env
  // maps are direction-only (see contactPoint's docs elsewhere in this file
  // for the analogous fact about translation), moving the RING would do
  // nothing to its reflection — but moving the STUDIO's contents relative to
  // the bake origin changes the angle from that origin to every light/wall,
  // which is the real lever (confirmed empirically — RoomEnvironment's own
  // built-in lights are far brighter than ours, e.g. its overhead area light
  // alone is intensity 100, so they dominate the reflection pattern;
  // repositioning just our own reflectors barely moved anything).
  const studioParams = {
    envTiltX: 0, // client tried tilting the rig, then found envOffsetY (below) alone gave the look wanted — tilt back to 0, v1 (2026-09-05)
    envOffsetY: 8.5, // "height of the ring within the studio" (see note above) — Round 17, client re-tuned via ?zscdebug=1 (was 7)
    floor: 1.6,
    key: { x: 7, y: 8, z: 8, w: 16, h: 10, power: 4.2 },
    fill: { x: -9, y: 5, z: 3, w: 14, h: 11, power: 2.1 },
    back: { x: -4, y: 6, z: -10, w: 20, h: 16, power: 1.3 },
    // Round 17: sharpened from 0.12 (creamy/soft) to 0.02 — a sharper PMREM
    // bake gives the gold band crisper, more defined reflections (this also
    // matters for the diamond's own reflections, see decisions.md #69's
    // "pure mirror" experiment — softness there was the whole problem).
    blur: 0.02,
  };
  const pmrem = new THREE.PMREMGenerator(renderer);
  let envRT = pmrem.fromScene(buildStudio(), studioParams.blur);
  scene.environment = envRT.texture;

  const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 2000);
  const homePos = new THREE.Vector3(2, 7, 30);
  const homeTarget = new THREE.Vector3(0, 0, 0);
  camera.position.copy(homePos);

  // OrbitControls orbits the camera around the pair — drag to rotate only.
  // Polar clamp opened up so it can be viewed from nearly straight above/
  // below; pan is off so it stays centred over its shadow.
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.05;
  controls.enablePan = false;
  // Wheel-zoom OFF (client, 2026-09-10): with it on, scrolling the page while
  // the pointer is over the canvas got swallowed by OrbitControls and zoomed
  // the ring instead of scrolling — the page scroll would "stick". The +/−
  // toolbar buttons (scene.zoom()) still dolly the camera, so no feature lost.
  controls.enableZoom = false;
  controls.minDistance = 10;
  controls.maxDistance = 160;
  // The camera can rise all the way to a full flat-lay top-down shot
  // (minPolarAngle≈0), but going the other way it stops just past the
  // horizon — like a real camera "bouncing off" the table, close enough to
  // graze the surface and catch the shadow, but never actually going under.
  controls.minPolarAngle = 7 * Math.PI / 180;  // tuned live via ?zscdebug=1 — final
  controls.maxPolarAngle = 84 * Math.PI / 180; // tuned live via ?zscdebug=1 — final
  controls.rotateSpeed = 0.95;
  controls.zoomSpeed = 0.9;
  controls.autoRotate = false;
  controls.autoRotateSpeed = 0.32; // slow, deliberate — matches the reference's pace
  controls.target.copy(homeTarget);
  controls.addEventListener('change', () => invalidate(50));

  const key = new THREE.DirectionalLight(0xffffff, 1.4);
  key.position.set(7, 34, 9); // mostly overhead — keeps the contact shadow tight under the pair, not cast off to one side
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.camera.near = 5;
  key.shadow.camera.far = 140;
  key.shadow.bias = -0.0015;
  key.shadow.radius = 22; // soft, diffused contact shadow — proper blurred edge, not a flat cutout
  scene.add(key);
  // A DirectionalLight's shadow camera is centred on key.target, which
  // defaults to world origin (0,0,0) — fine while the pair sat there, but
  // the current pose offsets it off-centre, so the shadow frustum was
  // silently clipping part of one ring (self/mutual cast shadow only
  // covering "half" the band). frameScene() below re-centres this on the
  // pair's REAL bounding-box centre every time it (re)frames. The target
  // must be added to the scene for a repositioned target to take effect.
  scene.add(key.target);
  const rim = new THREE.DirectionalLight(0xfff2e6, 0.32); // warm rim
  rim.position.set(-16, 7, -12);
  scene.add(rim);

  // Fixed, INVISIBLE ground plane so a soft contact shadow is always visible
  // beneath the pair. A visible studio table was tried here (client request)
  // and then rejected — reverted to the plain invisible ShadowMaterial
  // catcher. Its shadow camera's frustum is re-fit to the rings' actual size
  // in frameScene().
  const GROUND_Y = 0;
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(600, 600),
    // Client (earlier round): turn the real cast shadow off, let the
    // per-ring contact-AO blob do that job alone. Left fully wired (not
    // removed) so the ?zscdebug=1 "Providnost senke" slider can still bring
    // it back to compare side-by-side.
    new THREE.ShadowMaterial({ opacity: 0 }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = GROUND_Y;
  ground.receiveShadow = true;
  scene.add(ground);

  // A real shadow-map always has some penumbra, and once its light is mostly
  // overhead the darkest part of that blur sits UNDER the ring rather than
  // hugging its base — from most angles that reads as a gap between the ring
  // and its shadow. So on top of the real shadow, drop a small soft dark
  // "contact AO" ellipse exactly at each ring's true ground-contact point
  // (computed in buildBandFor). This guarantees zero visible gap regardless
  // of light/camera angle — a standard product-render trick, not a physical
  // shadow.
  function makeContactTexture() {
    const s = 128;
    const c = document.createElement('canvas');
    c.width = c.height = s;
    const ctx = c.getContext('2d');
    const g = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
    g.addColorStop(0, 'rgba(20,16,10,0.55)');
    g.addColorStop(0.55, 'rgba(20,16,10,0.28)');
    g.addColorStop(1, 'rgba(20,16,10,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, s, s);
    return new THREE.CanvasTexture(c);
  }
  const contactTex = makeContactTexture();
  // Per-ring, mutable so the temporary debug panel (?zscdebug=1) can
  // live-tune each ring's contact-AO blob INDEPENDENTLY — her and his have
  // different tilt/roll, so one shared set of multipliers can't fit both.
  // Applied against each ring's own outerR/GROUND_Y in buildBandFor() below.
  const blobParams = {
    her: { scaleX: 1.51, scaleY: 0.52, offsetY: 0.02 },
    his: { scaleX: 1.51, scaleY: 0.52, offsetY: 0.02 },
  };
  function makeContactBlob() {
    const m = new THREE.Mesh(
      new THREE.PlaneGeometry(1, 1),
      new THREE.MeshBasicMaterial({
        map: contactTex, transparent: true, depthWrite: false, toneMapped: false,
      }),
    );
    m.rotation.x = -Math.PI / 2;
    m.renderOrder = 1; // draw after the ground so it isn't z-fought
    scene.add(m);
    return m;
  }

  function buildStudio() {
    // Client liked RoomEnvironment's overall depth/variation, just not its 6
    // decorative "furniture" boxes (box1..box6 in the addon source) — those
    // reflected as sharp diamond/kite-shaped highlights on the metal at some
    // angles. The room's enclosing walls + its 6 real area-light panels +
    // its point light all stay. RoomEnvironment gives ALL 6 furniture boxes
    // the exact same MeshStandardMaterial INSTANCE (the room walls and each
    // area light each get their own distinct material) — so the material
    // that more than one mesh shares IS the furniture, found generically
    // rather than by hardcoding its positions (fragile against upstream
    // addon changes).
    const s = new RoomEnvironment();
    const materialUseCount = new Map();
    s.children.forEach((c) => {
      if (c.isMesh) materialUseCount.set(c.material, (materialUseCount.get(c.material) || 0) + 1);
    });
    const furnitureMaterial = [...materialUseCount.entries()].find(([, count]) => count > 1);
    if (furnitureMaterial) {
      s.children
        .filter((c) => c.isMesh && c.material === furnitureMaterial[0])
        .forEach((c) => s.remove(c));
    }
    const box = (p) => {
      const m = new THREE.Mesh(
        new THREE.PlaneGeometry(p.w, p.h),
        new THREE.MeshBasicMaterial({
          color: new THREE.Color(p.power, p.power, p.power),
          map: glowTex, transparent: true, side: THREE.DoubleSide,
        }),
      );
      m.position.set(p.x, p.y, p.z);
      m.lookAt(0, 0, 0);
      s.add(m);
    };
    // lift the lower hemisphere so the underside reflection is grey, not black
    const fc = studioParams.floor;
    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(40, 40),
      new THREE.MeshBasicMaterial({ color: new THREE.Color(fc, fc * 0.9875, fc * 0.969) }),
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -6;
    s.add(floor);
    // Two large, soft round reflectors — fewer, bigger, round-edged sources
    // blur together into one smooth gradient sweep on the metal instead of
    // several distinct hard-edged hotspots.
    box(studioParams.key);   // large + soft, upper front-right
    box(studioParams.fill);  // large + soft, left
    // Broad, dim back-fill — without it, the side of the band facing away
    // from both softboxes reflects nothing and shows as a flat patch of raw
    // material colour instead of metal. Big and faint on purpose: it should
    // read as ambient bounce, not another hotspot.
    box(studioParams.back);
    s.rotation.x = studioParams.envTiltX;
    // Translate the studio DOWN by envOffsetY so the bake origin (where the
    // ring effectively "is", direction-wise) ends up effectively that much
    // HIGHER inside the room — see the big note above studioParams.
    s.position.y = -studioParams.envOffsetY;
    s.updateMatrixWorld(true);
    return s;
  }

  // ------------------------------------------------------------------- rigs

  // NOTE on envMap/envMapIntensity: this three.js build only honours a
  // material's OWN envMapIntensity when the material has an explicit envMap
  // texture. Without one (i.e. just relying on scene.environment for IBL,
  // which is all this scene did until now), the renderer silently
  // substitutes ONE scene-wide `scene.environmentIntensity` instead
  // (WebGLRenderer's setProgram: `isMeshStandardMaterial && envMap===null &&
  // environment!==null → uniforms.envMapIntensity = environmentIntensity`) —
  // so material.envMapIntensity was a complete no-op for every ring, and two
  // rings could never have independently different shine even in principle.
  // Assigning the same PMREM texture as an explicit envMap on each material
  // opts it back into per-material control.
  // -------------------------------------------------------------- diamond
  //
  // Rebuilt 2026-09-24 (decisions #73 — Pavle's diamond v2, approved side by
  // side against wamagold-configurator.com). Replaces the Round 10–17 stone
  // (16-sided approximation + baked vertex colours + additive sparkle
  // sprites, decisions #51–#72) that always read as a white/milky disc.
  // See assets/js/diamond-kit.js for the details:
  //   * exact 57-facet round brilliant (table 57 %, crown 34.5°, pavilion
  //     40.75°, depth 59.6 %) built as an intersection of half-spaces;
  //   * a ShaderMaterial that ray-traces light INSIDE the stone against those
  //     same facet planes — Fresnel, total internal reflection, refraction
  //     out, 3 IORs for dispersion ("fire"). Pure GLSL maths, so it looks the
  //     same on SwiftShader (WSL dev box) as on a real GPU — the old hard
  //     constraint (no transmission on software GL) no longer applies;
  //   * its OWN sharp, high-contrast cube map (strip lights + small hot
  //     points + black flags + a dark "viewer's head" disc at the zenith that
  //     gives the classic arrows pattern). The metal keeps its own LUT look
  //     (studio-v3, Faza 2) — the stone's studio never touches it.
  //   * flush ("utisnut") setting done for real: the band fragment shader
  //     discards a round hole at each stone (attachBottomShade → uHoles) and
  //     a countersunk seat wall closes it (buildSeatGeometry). The table sits
  //     level with the band surface, as in the client's .3dm CAD (#69).
  // Everything live-tunable via ?zscdebug=1 → stoneParams → setStoneMat().
  const coarsePointer = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;
  let stoneParams = {
    prominence: 1.0,        // 1 = true size (the approved look); >1 exaggerates
    envPreset: 'kontrast',  // kontrast | svetlo | tamno (diamond-kit ENV_PRESETS)
    envIntensity: 1.0,
    dispersion: 1.0,        // 1 = real diamond spread (nC..nF), 2 = exaggerated
    bounces: coarsePointer ? 5 : 6,
    seatMix: 0.85,          // how much light leaving through the pavilion picks up the metal
    flushDepth: 0.012,      // mm the table sits below the band surface
    holeTop: 1.03,          // seat opening at the surface (× stone radius)
    holeBottom: 0.955,      // seat wall at the girdle (× stone radius) — metal overlaps the girdle
  };
  const brilliant = buildBrilliant();
  const gemGeo = new THREE.BufferGeometry();
  gemGeo.setAttribute('position', new THREE.BufferAttribute(brilliant.positions, 3));
  gemGeo.setAttribute('normal', new THREE.BufferAttribute(brilliant.normals, 3));
  gemGeo.computeBoundingSphere();
  // Built lazily on the first stone, so ring-only scenes pay nothing.
  let diamondEnvRT = null;
  let diamondEnvPreset = null;
  function ensureDiamondEnv() {
    if (diamondEnvRT && diamondEnvPreset === stoneParams.envPreset) return diamondEnvRT;
    const old = diamondEnvRT;
    diamondEnvRT = buildDiamondEnv(THREE, renderer, stoneParams.envPreset);
    diamondEnvPreset = stoneParams.envPreset;
    ['her', 'his'].forEach((k) => {
      const rig = rigs[k];
      if (rig && rig.gemMat) rig.gemMat.uniforms.uEnv.value = diamondEnvRT.texture;
    });
    if (old) old.dispose();
    return diamondEnvRT;
  }
  function makeGemMaterial() {
    return createDiamondMaterial(THREE, brilliant, ensureDiamondEnv().texture, {
      dispersion: stoneParams.dispersion, bounces: stoneParams.bounces,
      envIntensity: stoneParams.envIntensity, seatMix: stoneParams.seatMix,
    });
  }

  // Materijal "Dve boje"/"Tri boje" multi-colour band (client, 2026-09-07,
  // decisions.md #34→real): a custom per-vertex `aBandY` attribute (set in
  // buildBandFor = that vertex's LOCAL width-axis position) lets the metal
  // shader pick a zone LUT per fragment (createLutMetalMaterial). Only
  // straight width-ratio splits (1:1, 1:2, 2:1…) are done this way —
  // wave/diagonal/segment/axial need a per-angle coordinate and aren't
  // implemented yet (configurator.js's colorZonesFor() returns null for those
  // = ordinary single-metal ring). The old fake bottom-darkening ("Senčenje
  // pri dnu") is gone with Faza 2 — it would bend the LUT colours.
  // `zones` = { metals: [slug,...], stops: [mm,...] } | null.
  function applyColorZones(mat, zones) {
    const u = mat.userData.lut;
    const metals = zones ? (zones.metals || []) : [];
    u.uZoneCount.value = metals.length;
    if (metals.length) {
      u.uLut.value = lutFor(metals[0]);
      u.uLutB.value = lutFor(metals[1]);
      u.uLutC.value = lutFor(metals[2] || metals[1]);
      u.uStop1.value = zones.stops[0] || 0;
      u.uStop2.value = zones.stops[1] || 0;
    }
  }

  const envs = getEnvs();
  function makeRig(key) {
    const root = new THREE.Group();
    scene.add(root);
    const mat = createLutMetalMaterial(envs);
    // Seat wall of the flush setting — same metal (shares the band's LUT
    // uniforms), a touch rougher (drilled + burnished): reads partly from
    // the blurred studio, see loop().
    const seatMat = createLutMetalMaterial(envs, mat.userData.lut);
    return {
      key, root, mat, seatMat, gemMat: null, stones: [], seats: [], band: null, stone: null, outer: 8,
      blob: pairMode ? makeContactBlob() : null,
      target: { blur: 0 },
    };
  }
  const rigs = { her: makeRig('her'), his: makeRig('his') };
  rigs.his.root.visible = pairMode; // thumbnail scenes only ever use "her"
  if (rigs.his.blob) rigs.his.blob.visible = pairMode;

  function poseFor(key) {
    return pairMode ? POSE[key] : { rot: POSE[key].rot, off: ZERO };
  }

  // ------------------------------------------------------------------ geometry

  // Cross-section in the (radius, axial) plane. x = distance from finger axis,
  // y = position across the band width. Returned as a closed Vector2 loop.
  function profilePoints(shape, innerR, thickness, width, outline) {
    const outerR = innerR + thickness;
    const h = width / 2;
    const pts = [];

    // Parametric profiles (client, 2026-09-08): configurator.js samples the
    // cross-section outline once (paramProfileOutline) and passes it in via
    // sceneStateFor, so the 3D band is exactly the shape the Profil card
    // drew. outline pts are normalised: nx in [-1,1] width axis, ny in
    // [-1,1] thickness axis (ny=-1 outer / ny=+1 inner/finger side).
    if (shape === 'param' && Array.isArray(outline) && outline.length > 2) {
      for (let i = 0; i < outline.length; i++) {
        const nx = outline[i][0], ny = outline[i][1];
        const r = innerR + ((1 - ny) / 2) * thickness;
        pts.push(new THREE.Vector2(r, nx * h));
      }
      if (!pts[0].equals(pts[pts.length - 1])) pts.push(pts[0].clone());
      return pts;
    }
    const arc = (cx, cy, r, a0, a1, steps) => {
      for (let i = 0; i <= steps; i++) {
        const a = a0 + (a1 - a0) * (i / steps);
        pts.push(new THREE.Vector2(cx + Math.cos(a) * r, cy + Math.sin(a) * r));
      }
    };

    if (shape === 'round') {
      // full oval cross-section
      const cx = (innerR + outerR) / 2;
      const rx = thickness / 2;
      for (let i = 0; i <= 48; i++) {
        const a = (i / 48) * Math.PI * 2;
        pts.push(new THREE.Vector2(cx + Math.cos(a) * rx, Math.sin(a) * h));
      }
    } else if (shape === 'd-comfort') {
      // flat inside, domed outside (D)
      const bulge = Math.min(thickness * 0.9, h);
      pts.push(new THREE.Vector2(innerR, -h));
      pts.push(new THREE.Vector2(innerR, h));
      // outer dome from top edge to bottom edge
      for (let i = 0; i <= 24; i++) {
        const a = Math.PI / 2 - (i / 24) * Math.PI; // +90° -> -90°
        pts.push(new THREE.Vector2((outerR - bulge) + Math.cos(a) * bulge, Math.sin(a) * h));
      }
    } else if (shape === 'court') {
      // comfort/court: gently domed outside, slightly relieved inside
      const inR = thickness * 0.28;   // inner comfort curve depth
      const outR = thickness * 0.55;  // outer dome
      // inner curve (bulges toward the finger centre a touch)
      for (let i = 0; i <= 16; i++) {
        const a = -Math.PI / 2 + (i / 16) * Math.PI;
        pts.push(new THREE.Vector2(innerR + inR - Math.cos(a) * inR, Math.sin(a) * h));
      }
      // outer dome
      for (let i = 0; i <= 24; i++) {
        const a = Math.PI / 2 - (i / 24) * Math.PI;
        pts.push(new THREE.Vector2((outerR - outR) + Math.cos(a) * outR, Math.sin(a) * h));
      }
    } else {
      // 'flat' (ravni) — plain rectangle, sharp outer corners. Used to have a
      // small chamfer on each outer edge; client (Round 14, 2026-09-15,
      // screenshot): "duple ivice" — the chamfer's two facet boundaries
      // (top-face→chamfer, chamfer→outer-wall) sit close enough together
      // that the studio's few hard-edged lights put a separate bright
      // specular streak on each, reading as a doubled/duplicated rim line
      // rather than one clean bevel. A single sharp corner has only one
      // edge to catch a highlight — matches WamaGold's plain flat-band look.
      pts.push(new THREE.Vector2(innerR, -h));
      pts.push(new THREE.Vector2(innerR, h));
      pts.push(new THREE.Vector2(outerR, h));
      pts.push(new THREE.Vector2(outerR, -h));
    }
    // close the loop
    if (pts.length && !pts[0].equals(pts[pts.length - 1])) pts.push(pts[0].clone());
    return pts;
  }

  const LATHE_SEGMENTS = 260;

  // ---- grooves: cut a real channel INTO the band silhouette --------------
  //
  // Client, 2026-09-10: the old grooves stood OUT (a raised applied ridge);
  // a groove is a channel cut IN. Instead of per-profile-shape surgery this
  // works on the finished band mesh: buildBandFor densifies the cross-section
  // along its WIDTH (so there are enough vertex rows for crisp groove walls),
  // then carveGroovesIntoGeometry() pushes the OUTER-surface vertices
  // radially inward by a per-shape depth profile wherever they fall inside a
  // groove's width span. The inner wall never moves. One code path for flat /
  // round / court / d-comfort / all 14 param profiles. Grooves wrap the full
  // circumference here; a partial-wrap 'horizontal'/'wave' groove stays a v2
  // job (needs a per-angle cut).
  function grooveCut(shape, t, depth) {
    const s = Math.max(0, Math.min(1, t));               // position across groove width
    switch (shape) {
      case 'v90':
      case 'vsharp':
        return depth * (1 - Math.abs(2 * s - 1));        // sharp V
      case 'angular':
      case 'square':
      case 'kanal': {
        const r = 0.16;                                  // flat bottom, ramped walls
        return depth * (s < r ? s / r : s > 1 - r ? (1 - s) / r : 1);
      }
      default:
        return depth * Math.sqrt(Math.max(0, 1 - (2 * s - 1) ** 2)); // round U
    }
  }

  function densifyLoop(pts, maxLen) {
    const out = [];
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i], b = pts[i + 1];
      out.push(a);
      const d = a.distanceTo(b);
      if (d > maxLen) {
        const steps = Math.ceil(d / maxLen);
        for (let k = 1; k < steps; k++) out.push(a.clone().lerp(b, k / steps));
      }
    }
    out.push(pts[pts.length - 1]);
    return out;
  }

  const _gv = new THREE.Vector3();
  // geo: band LatheGeometry AFTER rotateY(-90°) — Y stays the width axis.
  function carveGroovesIntoGeometry(geo, grooves, innerR, outerR) {
    if (!grooves || !grooves.length) return;
    const pos = geo.attributes.position;
    const mid = (innerR + outerR) / 2;
    const minR = innerR + 0.22;                          // keep a wall
    for (let idx = 0; idx < pos.count; idx++) {
      _gv.fromBufferAttribute(pos, idx);
      const rad = Math.hypot(_gv.x, _gv.z);
      if (rad <= mid) continue;                          // inner half — never carved
      const w = _gv.y;                                   // mm from band centre (width axis)
      const outerness = Math.min(1, (rad - mid) / Math.max(outerR - mid, 1e-4));
      let sink = 0;
      for (let g = 0; g < grooves.length; g++) {
        const gr = grooves[g];
        const gw = Math.max(gr.width || 0.3, 0.06);
        const t = (w - ((gr.position || 0) - gw / 2)) / gw;
        if (t < 0 || t > 1) continue;
        sink = Math.max(sink, grooveCut(gr.shape, t, Math.max(gr.depth || 0.15, 0.03)));
      }
      if (sink <= 0) continue;
      const f = Math.max(minR, rad - sink * outerness) / rad;
      pos.setX(idx, _gv.x * f);
      pos.setZ(idx, _gv.z * f);
    }
    pos.needsUpdate = true;
    geo.computeVertexNormals();
  }

  // World-space (minY, x, z) of a rig's actual lowest vertex. A plain Box3
  // only gives an AABB min corner — fine while every ring stood dead
  // upright, but once a ring can lean/roll (POSE above) the AABB's min.y
  // doesn't tell us WHERE under the ring that low point actually is, so a
  // tilted ring's true ground-contact spot can sit well off its pivot.
  // Walking the real vertices gives both: minY levels the ring onto the
  // floor exactly as before, and x/z lets the contact-AO blob (in
  // buildBandFor below) sit under wherever the ring ACTUALLY touches down,
  // so it genuinely tracks that ring instead of a static disc under its
  // centre.
  const _cp = new THREE.Vector3();
  function contactPoint(root) {
    let minY = Infinity, maxY = -Infinity, x = 0, z = 0;
    root.traverse((obj) => {
      const geo = obj.geometry;
      if (!obj.isMesh || !geo || !geo.attributes || !geo.attributes.position) return;
      const pos = geo.attributes.position;
      for (let i = 0; i < pos.count; i++) {
        _cp.fromBufferAttribute(pos, i).applyMatrix4(obj.matrixWorld);
        if (_cp.y < minY) { minY = _cp.y; x = _cp.x; z = _cp.z; }
        if (_cp.y > maxY) maxY = _cp.y;
      }
    });
    return { minY, maxY, x, z };
  }

  function buildBandFor(key, state) {
    const rig = rigs[key];
    const size = state.size || 54;                 // EU size ≈ inner circumference mm
    const innerR = size / (2 * Math.PI);
    const thickness = state.thickness || 1.4;
    const outerR = innerR + thickness;
    let pts = profilePoints(state.profileShape || 'flat', innerR, thickness, state.width || 4, state.profileOutline);
    const grooves = state.grooves || [];
    // Grooves are cut into the band itself now — densify the cross-section so
    // the carve below has enough vertex rows for sharp groove walls.
    if (grooves.length) pts = densifyLoop(pts, 0.18);
    const geo = new THREE.LatheGeometry(pts, LATHE_SEGMENTS);
    // Custom per-vertex attribute carrying each vertex's LOCAL width-axis
    // position (same y profilePoints() already works in) — feeds the
    // Materijal multi-colour shader hook (createLutMetalMaterial/applyColorZones)
    // so it can pick a zone colour by width position. LatheGeometry's own
    // vertex order is angular-slice-major, point-index-minor (index =
    // i*pts.length + j) — rotateY() below only rotates X/Z, Y is untouched,
    // so this doesn't need to be recomputed after it.
    {
      const n = pts.length;
      const bandY = new Float32Array((LATHE_SEGMENTS + 1) * n);
      for (let i = 0; i <= LATHE_SEGMENTS; i++) {
        for (let j = 0; j < n; j++) bandY[i * n + j] = pts[j].y;
      }
      geo.setAttribute('aBandY', new THREE.BufferAttribute(bandY, 1));
    }
    geo.rotateY(-Math.PI / 2);     // move the lathe seam to the left silhouette edge
    mergeLatheSeamIndices(geo, pts.length, LATHE_SEGMENTS);
    geo.computeVertexNormals();
    carveGroovesIntoGeometry(geo, grooves, innerR, outerR);
    rig.profilePts = pts;
    rig.innerR = innerR;
    rig.thickness = thickness;
    if (rig.band) { rig.band.geometry.dispose(); rig.band.geometry = geo; }
    else {
      rig.band = new THREE.Mesh(geo, rig.mat);
      rig.band.castShadow = true;
      rig.band.receiveShadow = true;
      rig.root.add(rig.band);
    }
    rig.outer = outerR;
    const pose = poseFor(key);
    rig.root.rotation.copy(pose.rot);
    // X/Z from the pose (the side-by-side overlap); Y is resolved below so
    // the ring's own lowest point always lands exactly on the ground — no
    // "floating above its shadow" gap, whatever its size/tilt/profile is.
    rig.root.position.set(pose.off.x * outerR, 0, pose.off.z * outerR);
    rig.root.updateMatrixWorld(true);
    const contact = contactPoint(rig.root);
    // pose.off.y is an intentional EXTRA lift above strict ground contact
    // (× this ring's own radius) — e.g. to let one ring visually rest a
    // touch higher than the other. The ring is already glued to the floor
    // via `contact.minY` before this is added, so it can't float/clip on
    // its own; off.y only ever adds on top of that.
    const lift = GROUND_Y - contact.minY + pose.off.y * outerR;
    rig.root.position.y += lift;
    if (rig.blob) {
      // Anchored at the ring's real lowest point (x/z), not its pivot — so
      // the blob follows THIS ring's own tilt/roll instead of sitting as a
      // static disc under its centre regardless of pose. scaleX/scaleY/
      // offsetY come from THIS ring's own blobParams entry, independent of
      // the other ring's.
      const bp = blobParams[key];
      rig.blob.position.set(contact.x, GROUND_Y + bp.offsetY, contact.z);
      rig.blob.scale.set(outerR * bp.scaleX, outerR * bp.scaleY, 1);
      // Match the ring's own roll (pose.rot.z) so the ellipse's long axis
      // turns WITH the ring instead of always sitting axis-aligned — a
      // rolled ring (e.g. her 15°) needs its shadow rolled the same amount
      // to look glued rather than crooked underneath it. x stays -90° so it
      // still lies flat on the ground; only the in-plane (z) roll follows.
      rig.blob.rotation.set(-Math.PI / 2, 0, pose.rot.z);
    }
    return outerR;
  }

  // Radius of the band's OUTER surface at width position w (band-local y),
  // straight from the cross-section loop — so a seat rim sits exactly on a
  // domed (court / param) profile instead of floating above it.
  function outerRadiusAt(pts, w) {
    let best = -Infinity;
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i], b = pts[i + 1];
      const lo = Math.min(a.y, b.y), hi = Math.max(a.y, b.y);
      if (w < lo - 1e-6 || w > hi + 1e-6) continue;
      const x = Math.abs(b.y - a.y) < 1e-9 ? Math.max(a.x, b.x) : a.x + (b.x - a.x) * ((w - a.y) / (b.y - a.y));
      if (x > best) best = x;
    }
    return best > 0 ? best : null;
  }

  // Countersunk seat wall around one stone, in band-local space. `ax` =
  // radial axis of the stone, `tg` = circumferential tangent, width axis = Y.
  function buildSeatGeometry(pts, ax, tg, widthPos, rTop, rBot, zBottom, outerR) {
    const N = 48, pos = [], idx = [];
    for (let i = 0; i <= N; i++) {
      const ang = (i / N) * Math.PI * 2, c = Math.cos(ang), sn = Math.sin(ang);
      // top ring: on the real surface at that width
      const wy = widthPos + c * rTop, t = sn * rTop;
      const R = outerRadiusAt(pts, wy) || outerR;
      const sTop = Math.sqrt(Math.max(R * R - t * t, 0)) - 0.002;
      pos.push(ax.x * sTop + tg.x * t, wy, ax.z * sTop + tg.z * t);
      // bottom ring: just under the girdle
      const wb = widthPos + c * rBot, tb = sn * rBot;
      pos.push(ax.x * zBottom + tg.x * tb, wb, ax.z * zBottom + tg.z * tb);
    }
    for (let i = 0; i < N; i++) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    const c0 = pos.length / 3;
    pos.push(ax.x * (zBottom - 0.002), widthPos, ax.z * (zBottom - 0.002));
    for (let i = 0; i < N; i++) { const a = i * 2 + 1; idx.push(c0, a + 2, a); }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    // Width-axis position (= band-local y) so two/three-tone zones pick the
    // same LUT on the seat wall as on the band around it.
    const bandY = new Float32Array(pos.length / 3);
    for (let i = 0; i < bandY.length; i++) bandY[i] = pos[i * 3 + 1];
    g.setAttribute('aBandY', new THREE.BufferAttribute(bandY, 1));
    g.setIndex(idx);
    g.computeVertexNormals();
    return g;
  }

  function setHoles(rig, holes) {
    const H = rig.mat.userData.holes;
    H.uHoleCount.value = Math.min(holes.length, MAX_HOLES);
    for (let i = 0; i < MAX_HOLES; i++) {
      const h = holes[i];
      if (h) { H.uHoles.value[i].set(h.ax, h.az, h.w, h.r); H.uHoleZ.value[i] = h.z; } else { H.uHoleZ.value[i] = 1e6; }
    }
  }

  const _stoneUp = new THREE.Vector3(0, 1, 0);
  const _ax = new THREE.Vector3();
  const _tg = new THREE.Vector3();

  // state.stone = { mm, positions: [mm along band, ...], widthPos }.
  // "Količina"/"Pozicioniranje" UI choices resolve to the `positions` list
  // before this sees it; this just places whatever it's given. `position`
  // (singular) is still accepted as single-stone shorthand.
  function buildStoneFor(key, state) {
    const rig = rigs[key];
    const s = state.stone;
    const positions = s && s.mm ? (s.positions || [typeof s.position === 'number' ? s.position : 0]) : [];
    const n = Math.min(positions.length, MAX_HOLES);

    rig.seats.forEach((m) => { rig.root.remove(m); m.geometry.dispose(); });
    rig.seats = [];
    rig.stones.forEach((m) => { m.visible = false; });
    if (!n || !rig.profilePts) { setHoles(rig, []); return; }

    if (!rig.gemMat) rig.gemMat = makeGemMaterial();
    const P = stoneParams;
    const size = state.size || 54;
    const innerR = size / (2 * Math.PI);
    const thickness = state.thickness || 1.4;
    const outerR = innerR + thickness;
    const meanCirc = Math.PI * (innerR + outerR);
    // Keep the whole stone (crown + pavilion ≈ 1.19 r deep) inside the metal.
    const depthPerR = brilliant.yTable - brilliant.yCulet;
    const r = Math.min((s.mm / 2) * P.prominence, Math.max(0.2, (thickness - 0.1) / depthPerR));
    const widthPos = s.widthPos || 0;
    const R = outerRadiusAt(rig.profilePts, widthPos) || outerR;
    const tableZ = R - P.flushDepth;
    const girdleZ = tableZ - brilliant.yTable * r;
    const holes = [];

    for (let i = 0; i < n; i++) {
      const theta = ((positions[i] || 0) / meanCirc) * Math.PI * 2;   // 0 = +Z
      _ax.set(Math.sin(theta), 0, Math.cos(theta));
      _tg.set(Math.cos(theta), 0, -Math.sin(theta));
      let gem = rig.stones[i];
      if (!gem) {
        gem = new THREE.Mesh(gemGeo, rig.gemMat);
        gem.renderOrder = 3;
        rig.root.add(gem);
        rig.stones[i] = gem;
      }
      gem.material = rig.gemMat;
      gem.visible = true;
      gem.scale.setScalar(r);
      gem.position.set(_ax.x * girdleZ, widthPos, _ax.z * girdleZ);
      gem.quaternion.setFromUnitVectors(_stoneUp, _ax);
      gem.rotateY(Math.PI / 16 + i * 0.37);   // each stone catches light a bit differently

      const seat = new THREE.Mesh(
        buildSeatGeometry(rig.profilePts, _ax, _tg, widthPos, r * P.holeTop, r * P.holeBottom, girdleZ - 0.012, outerR),
        rig.seatMat,
      );
      rig.root.add(seat);
      rig.seats.push(seat);
      holes.push({ ax: _ax.x, az: _ax.z, w: widthPos, r: r * P.holeTop, z: girdleZ - 0.05 });
    }
    setHoles(rig, holes);
    rig.gemMat.uniforms.uSeatColor.value.copy(seatColorFor(rig.mat.userData.lut.uLut.value));
  }

  // Grooves are cut straight into the band geometry — see
  // carveGroovesIntoGeometry() up near profilePoints(). No separate groove
  // meshes any more (client, 2026-09-10: a groove goes IN, not OUT).


  // --------------------------------------------------------------- engraving
  //
  // Real (if approximate) 3D engraving (client, 2026-09-08: "gravura i dalje
  // ne radi" — it was UI/state only before). The text is drawn to a canvas
  // and mapped onto a thin partial cylinder sitting a hair off the band's
  // inner (or outer) wall, reading as dark incised lettering when you look
  // into / at the ring. Not a true displaced cut (that's the canvas→normal/
  // height-map job in roadmap.md) — but it genuinely shows in the render and
  // tracks the text / side / ring size live.
  function buildEngravingFor(key, state) {
    const rig = rigs[key];
    const eng = state.engraving;
    if (!eng || !eng.text) { if (rig.engrave) rig.engrave.visible = false; return; }

    const size = state.size || 54;
    const innerR = size / (2 * Math.PI);
    const outerR = innerR + (state.thickness || 1.4);
    const width = state.width || 4;
    const inside = eng.side !== 'outside';

    if (!rig.engraveCanvas) {
      rig.engraveCanvas = document.createElement('canvas');
      rig.engraveCanvas.width = 2048; rig.engraveCanvas.height = 128;
    }
    const cv = rig.engraveCanvas, ctx = cv.getContext('2d');
    ctx.clearRect(0, 0, cv.width, cv.height);
    // Light + fine, like the Breuning reference (client, 2026-09-09: "gravura
    // je full crne boje, kod Breuninga je laganija i manji font").
    ctx.fillStyle = 'rgba(48,40,28,0.62)';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    let fs = 64;
    ctx.font = '400 ' + fs + 'px Georgia, "Times New Roman", serif';
    while (ctx.measureText(eng.text).width > cv.width * 0.8 && fs > 20) {
      fs -= 3; ctx.font = '400 ' + fs + 'px Georgia, "Times New Roman", serif';
    }
    ctx.fillText(eng.text, cv.width / 2, cv.height / 2 + 3);

    if (!rig.engraveTex) {
      rig.engraveTex = new THREE.CanvasTexture(cv);
      rig.engraveTex.colorSpace = THREE.SRGBColorSpace;
      rig.engraveTex.anisotropy = 4;
    }
    // Text on the inner wall is seen from the finger side (back face) — mirror
    // it horizontally so it doesn't read reversed; outer wall reads straight.
    rig.engraveTex.wrapS = THREE.ClampToEdgeWrapping;
    rig.engraveTex.repeat.x = inside ? -1 : 1;
    rig.engraveTex.offset.x = inside ? 1 : 0;
    rig.engraveTex.needsUpdate = true;

    // Sit just PROUD of the relevant wall (into the hole for inside, above the
    // outer surface for outside) so it's never buried in the opaque band.
    const r = inside ? innerR - 0.015 : outerR + 0.015;
    const h = Math.min(width * 0.42, 1.7);
    const arc = Math.min(Math.PI * 0.7, 0.4 + eng.text.length * 0.1);
    const thetaStart = -Math.PI / 2 - arc / 2; // centre the text at the front-bottom of the band

    if (rig.engrave) rig.engrave.geometry.dispose();
    const geo = new THREE.CylinderGeometry(r, r, h, 128, 1, true, thetaStart, arc);
    if (!rig.engrave) {
      const mat = new THREE.MeshBasicMaterial({
        map: rig.engraveTex, transparent: true, opacity: 0.85,
        depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4,
      });
      rig.engrave = new THREE.Mesh(geo, mat);
      rig.engrave.renderOrder = 2;
      rig.root.add(rig.engrave);
    } else {
      rig.engrave.geometry = geo;
    }
    rig.engrave.material.side = inside ? THREE.BackSide : THREE.FrontSide;
    rig.engrave.visible = true;
  }

  // ------------------------------------------------------------- material tween

  function applyMaterialFor(key, state) {
    const rig = rigs[key];
    const u = rig.mat.userData.lut;
    // Metal switch: cross-fade from what's on screen now to the new LUT
    // (uniform swap only, same program).
    const lut = lutFor(state.metal);
    if (lut !== u.uLut.value) {
      u.uLutPrev.value = u.uLut.value;
      u.uLut.value = lut;
      u.uLutMix.value = 0;
    }
    if (typeof state.roughness === 'number') rig.target.blur = state.roughness >= BLUR_ROUGHNESS ? 1 : 0;
    applyColorZones(rig.mat, state.colorZones || null);
    invalidate(30); // tween runs inside the render loop
  }

  // ---------------------------------------------------------------- framing

  let framed = false;

  // "View solo" (client, 2026-09-08): show only one ring of the pair, WITHOUT
  // touching the camera — the other ring (and its contact-AO blob) is just
  // hidden. null = show both. setState re-shows both every call, so this is
  // re-asserted from configurator.js right after each setState.
  let soloKey = null;
  function applySolo() {
    if (!pairMode) return;
    ['her', 'his'].forEach((k) => {
      const on = !soloKey || soloKey === k;
      if (rigs[k].root) rigs[k].root.visible = on;
      if (rigs[k].blob) rigs[k].blob.visible = on;
    });
  }

  function frameScene(outerHer, outerHis) {
    const maxOuter = Math.max(outerHer || 8, outerHis || 8);
    if (pairMode) {
      // Frame from the pair's REAL bounding box (now that both rings are
      // levelled onto GROUND_Y, rather than guessed from outerR heuristics)
      // — robust to whatever the pose/tilt/size actually produced.
      const box = new THREE.Box3();
      if (rigs.her.band) box.union(new THREE.Box3().setFromObject(rigs.her.root));
      if (rigs.his.band) box.union(new THREE.Box3().setFromObject(rigs.his.root));
      const center = box.getCenter(new THREE.Vector3());
      const diag = box.getSize(new THREE.Vector3()).length();
      const radius = diag * 1.4;
      homePos.set(center.x + radius * 0.05, center.y + radius * 0.42, center.z + radius * 0.95);
      homeTarget.copy(center);
      // Centre the shadow camera on the pair's REAL centre too — it was
      // stuck on world origin, off from the pair whenever the pose is
      // offset, silently clipping part of one ring out of the shadow
      // frustum (looked like "the shadow only covers half the ring").
      key.target.position.copy(center);
      key.target.updateMatrixWorld();
    } else {
      homePos.set(maxOuter * 0.05, maxOuter * 1.15, maxOuter * 2.35);
      homeTarget.set(0, 0, 0);
    }
    camera.position.copy(homePos);
    controls.target.copy(homeTarget);
    controls.update();

    // Re-fit the shadow camera's frustum to the actual ring size so the
    // contact shadow stays a single tight, soft pool under the pair instead
    // of a huge flat plane.
    const fr = Math.max(maxOuter * 2.6, 14);
    key.shadow.camera.left = -fr; key.shadow.camera.right = fr;
    key.shadow.camera.top = fr; key.shadow.camera.bottom = -fr;
    key.shadow.camera.updateProjectionMatrix();
  }

  // --------------------------------------------------------------- render loop

  let running = false;
  let dirty = 0;
  envs.onReady(() => invalidate(30));

  function invalidate(frames = 45) {
    dirty = Math.max(dirty, frames);
    if (!running) { running = true; requestAnimationFrame(loop); }
  }
  function loop() {
    dirty--;
    // material easing, both rigs
    ['her', 'his'].forEach((k) => {
      const rig = rigs[k];
      const u = rig.mat.userData.lut;
      if (u.uLutMix.value < 1) u.uLutMix.value = Math.min(1, u.uLutMix.value + 0.08);
      u.uBlurMix.value += (rig.target.blur - u.uBlurMix.value) * 0.12;
      rig.seatMat.userData.lut.uBlurMix.value = Math.max(0.5, u.uBlurMix.value);
      if (rig.gemMat) rig.gemMat.uniforms.uSeatColor.value.lerp(seatColorFor(u.uLut.value), 0.09);
      // Grooves are part of the band geometry now, so they follow for free.
    });
    const moving = controls.update();       // true while damping / auto-rotating
    // Hold the (transparent) canvas until the studio cubes are in — an
    // unloaded cube samples black and would flash a black ring.
    if (envs.ready) renderer.render(scene, camera);
    if (dirty > 0 || moving || controls.autoRotate) requestAnimationFrame(loop);
    else running = false;
  }

  // ---------------------------------------------------------------- public API

  function resize() {
    const w = host.clientWidth;
    const h = host.clientHeight;
    if (w < 2 || h < 2) return;          // layout not ready — avoid NaN in controls
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    invalidate(3);
  }
  const ro = new ResizeObserver(resize);
  ro.observe(host);
  resize();

  function setState(state = {}) {
    // Back-compat / thumbnail use: a bare ring-state object means "her" only.
    const pair = (state && (state.her || state.his)) ? state : { her: state };
    let outerHer = rigs.her.outer;
    let outerHis = rigs.his.outer;
    if (pair.her) {
      rigs.her.root.visible = true;
      const s = pair.her, last = rigs.her.last || {};
      const geomChanged = ['width', 'thickness', 'size', 'profileShape', 'profileKey'].some((k) => s[k] !== last[k]);
      const stoneChanged = JSON.stringify(s.stone || null) !== JSON.stringify(last.stone || null);
      const groovesChanged = JSON.stringify(s.grooves || null) !== JSON.stringify(last.grooves || null);
      const engChanged = JSON.stringify(s.engraving || null) !== JSON.stringify(last.engraving || null);
      // Grooves are carved into the band geometry, so a groove change is a
      // band rebuild now (was a separate ridge-mesh pass).
      if (geomChanged || groovesChanged || !rigs.her.band) outerHer = buildBandFor('her', s);
      if (geomChanged || stoneChanged) buildStoneFor('her', s);
      if (geomChanged || engChanged) buildEngravingFor('her', s);
      applyMaterialFor('her', s);
      rigs.her.last = { ...s, stone: s.stone ? { ...s.stone } : null, grooves: s.grooves ? s.grooves.map((g) => ({ ...g })) : null, engraving: s.engraving ? { ...s.engraving } : null };
    }
    if (pair.his && pairMode) {
      rigs.his.root.visible = true;
      const s = pair.his, last = rigs.his.last || {};
      const geomChanged = ['width', 'thickness', 'size', 'profileShape', 'profileKey'].some((k) => s[k] !== last[k]);
      const stoneChanged = JSON.stringify(s.stone || null) !== JSON.stringify(last.stone || null);
      const groovesChanged = JSON.stringify(s.grooves || null) !== JSON.stringify(last.grooves || null);
      const engChanged = JSON.stringify(s.engraving || null) !== JSON.stringify(last.engraving || null);
      if (geomChanged || groovesChanged || !rigs.his.band) outerHis = buildBandFor('his', s);
      if (geomChanged || stoneChanged) buildStoneFor('his', s);
      if (geomChanged || engChanged) buildEngravingFor('his', s);
      applyMaterialFor('his', s);
      rigs.his.last = { ...s, stone: s.stone ? { ...s.stone } : null, grooves: s.grooves ? s.grooves.map((g) => ({ ...g })) : null, engraving: s.engraving ? { ...s.engraving } : null };
    }
    if (!framed && (rigs.her.band || rigs.his.band)) {
      framed = true;
      frameScene(outerHer, outerHis);
    }
    applySolo();
    invalidate(60);
  }

  function screenshot(scale = 2) {
    const w = host.clientWidth, h = host.clientHeight;
    renderer.setPixelRatio(scale);
    renderer.setSize(w, h, false);
    renderer.render(scene, camera);
    const url = renderer.domElement.toDataURL('image/png');
    renderer.setPixelRatio(viewPixelRatio());
    resize();
    return url;
  }

  function zoom(factor) {
    const dir = camera.position.clone().sub(controls.target);
    const dist = THREE.MathUtils.clamp(dir.length() * factor, controls.minDistance, controls.maxDistance);
    camera.position.copy(controls.target).add(dir.setLength(dist));
    invalidate(20);
  }

  function reset() {
    controls.autoRotate = false;
    camera.up.set(0, 1, 0);
    camera.position.copy(homePos);
    controls.target.copy(homeTarget);
    controls.update();
    invalidate(40);
  }

  function setAutoRotate(on) {
    controls.autoRotate = (on === undefined) ? !controls.autoRotate : !!on;
    invalidate(controls.autoRotate ? 600 : 20);
    return controls.autoRotate;
  }

  // ------------------------------------------------------------- debug hook
  //
  // TEMPORARY, for live-tuning shadow/light/pose during Round 8 polish
  // (?zscdebug=1, see assets/js/debug-panel.js). Re-applies the current pose/
  // blob constants against each rig's last known state without touching
  // geometry — cheap enough to call on every slider drag. Remove this block
  // (and debug-panel.js / its conditional enqueue) once the numbers are
  // locked in and baked back into the constants above.
  function refreshPose() {
    ['her', 'his'].forEach((k) => {
      const rig = rigs[k];
      if (rig.last) {
        buildBandFor(k, rig.last);
        buildStoneFor(k, rig.last);
      }
    });
    invalidate(30);
  }

  // Re-bakes the PMREM environment from the current studioParams (softbox
  // positions/power/floor/blur) and re-points the stone material's envMap at
  // the fresh texture (the LUT metal has its own fixed studio-v3 cube) — a real render-target rebuild, heavier than the other
  // debug knobs, but still cheap for a handful of flat planes; fine to call
  // on every slider drag. Disposes the old render target.
  function rebuildEnvironment() {
    const old = envRT;
    envRT = pmrem.fromScene(buildStudio(), studioParams.blur);
    scene.environment = envRT.texture;
    old.dispose();
    invalidate(20);
  }

  // ------------------------------------------------------- ?calib=1 LUT test
  //
  // Dev-only check that NOTHING but the LUT colours the metal (Faza 2 step
  // 4). Renders only the ring bands (stones, engraving, shadows, blobs
  // hidden), draws the WebGL canvas into a 2D canvas in the same task, and
  // takes every 5th pixel with alpha > 250:
  //   lut        — nearest RGB distance (0–255) to the 512 colours of the
  //                metal's LUT; passes at median ≤ 3 and p75 ≤ 6
  //   brightness — same frame through an identity LUT = env index 0..1
  //                (p5/p25/p50/p75/p95; yellow target ≈ p5 ≥ .45,
  //                p50 .66–.78, p95 ≤ .95)
  // `metal` = LUT key (yellow/red/white/manganese/white-pd); default = the
  // her ring's current LUT. Forced onto both rings for the test, restored after.
  function calib(metal) {
    const luts = getLuts();
    const lutKey = metal || Object.keys(LUT_STOPS).find((k) => luts[k] === rigs.her.mat.userData.lut.uLut.value) || 'yellow';
    const bands = new Set([rigs.her.band, rigs.his.band].filter(Boolean));
    const vis = [];
    scene.traverse((o) => {
      vis.push([o, o.visible]);
      if ((o.isMesh || o.isSprite || o.isLine || o.isPoints) && !bands.has(o)) o.visible = false;
    });
    const saved = ['her', 'his'].map((k) => {
      const u = rigs[k].mat.userData.lut;
      return [u, u.uLut.value, u.uLutMix.value, u.uZoneCount.value, u.uBlurMix.value];
    });
    const grab = (lut) => {
      saved.forEach(([u]) => { u.uLut.value = lut; u.uLutMix.value = 1; u.uZoneCount.value = 0; u.uBlurMix.value = 0; });
      renderer.render(scene, camera);
      const src = renderer.domElement;
      const c2 = document.createElement('canvas');
      c2.width = src.width; c2.height = src.height;
      const cx = c2.getContext('2d', { willReadFrequently: true });
      cx.drawImage(src, 0, 0);   // same task as render → drawing buffer still valid
      const d = cx.getImageData(0, 0, c2.width, c2.height).data;
      const px = [];
      for (let i = 0; i < d.length; i += 20) if (d[i + 3] > 250) px.push(i);
      return { d, px };
    };
    const pct = (arr, p) => arr[Math.min(arr.length - 1, Math.floor(p * (arr.length - 1)))];
    const r3 = (v) => Math.round(v * 1000) / 1000;

    const lutTex = luts[lutKey];
    const L = lutTex.image.data;
    const a = grab(lutTex);
    const dist = a.px.map((i) => {
      let best = 1e9;
      for (let j = 0; j < LUT_SIZE; j++) {
        const dr = a.d[i] - L[j * 4], dg = a.d[i + 1] - L[j * 4 + 1], db = a.d[i + 2] - L[j * 4 + 2];
        const q = dr * dr + dg * dg + db * db;
        if (q < best) best = q;
      }
      return Math.sqrt(best);
    }).sort((x, y) => x - y);
    const b = grab(luts.identity);
    const idx = b.px.map((i) => b.d[i] / 255).sort((x, y) => x - y);

    vis.forEach(([o, v]) => { o.visible = v; });
    saved.forEach(([u, lut, mix, zc, blur]) => { u.uLut.value = lut; u.uLutMix.value = mix; u.uZoneCount.value = zc; u.uBlurMix.value = blur; });
    invalidate(5);

    const med = pct(dist, 0.5), p75 = pct(dist, 0.75);
    return {
      metal: lutKey,
      pixels: a.px.length,
      lut: { median: r3(med), p75: r3(p75), max: r3(dist[dist.length - 1] || 0), pass: a.px.length > 0 && med <= 3 && p75 <= 6 },
      brightness: { p5: r3(pct(idx, 0.05)), p25: r3(pct(idx, 0.25)), p50: r3(pct(idx, 0.5)), p75: r3(pct(idx, 0.75)), p95: r3(pct(idx, 0.95)) },
    };
  }
  if (/[?&]calib=1/.test(location.search)) {
    window.zscCalib = calib;
    envs.onReady(() => setTimeout(() => {
      ['yellow', 'red', 'white', 'manganese', 'white-pd'].forEach((k) => console.log('[zsc calib]', JSON.stringify(calib(k))));
    }, 1500));
  }

  const debugApi = {
    key, rim, ground, rigs, POSE, controls, camera,
    // Both take a ring key ('her'/'his') so each ring's contact-AO blob can
    // be tuned fully independently — they no longer share one set of values.
    getBlobParams: (ringKey) => ({
      ...blobParams[ringKey],
      opacity: rigs[ringKey].blob ? rigs[ringKey].blob.material.opacity : 1,
    }),
    setBlobParams(ringKey, { scaleX, scaleY, offsetY, opacity } = {}) {
      const bp = blobParams[ringKey];
      if (typeof scaleX === 'number') bp.scaleX = scaleX;
      if (typeof scaleY === 'number') bp.scaleY = scaleY;
      if (typeof offsetY === 'number') bp.offsetY = offsetY;
      if (typeof opacity === 'number' && rigs[ringKey].blob) {
        rigs[ringKey].blob.material.opacity = opacity;
      }
      refreshPose();
    },
    refreshPose,
    reframe() { frameScene(rigs.her.outer, rigs.his.outer); invalidate(30); },
    invalidate,
    studioParams,
    rebuildEnvironment,
    calib,

    // ---- diamond (?zscdebug=1 "Dijamant" sections) --------------------
    // The panel mutates stoneParams in place, then calls one of these.
    // setStoneMat = shader uniforms (+ diamond studio preset); rebuildStone =
    // re-place stones/seats (prominence, flush depth, seat size). setSparkle
    // stays as a no-op so older panel builds don't throw.
    stoneParams,
    setStoneMat() {
      const P = stoneParams;
      if (diamondEnvRT && diamondEnvPreset !== P.envPreset) ensureDiamondEnv();
      ['her', 'his'].forEach((k) => {
        const m = rigs[k].gemMat;
        if (!m) return;
        m.uniforms.uIor.value.set(...iorTriplet(P.dispersion));
        m.uniforms.uBounces.value = Math.round(P.bounces);
        m.uniforms.uEnvIntensity.value = P.envIntensity;
        m.uniforms.uSeatMix.value = P.seatMix;
      });
      invalidate(20);
    },
    rebuildStone() {
      ['her', 'his'].forEach((k) => { if (rigs[k].last) buildStoneFor(k, rigs[k].last); });
      invalidate(30);
    },
    setSparkle() {},
  };

  function dispose() {
    ro.disconnect();
    controls.dispose();
    rigs.her.band && rigs.her.band.geometry.dispose();
    rigs.his.band && rigs.his.band.geometry.dispose();
    rigs.her.mat.dispose();
    rigs.his.mat.dispose();
    rigs.her.blob && rigs.her.blob.material.dispose();
    rigs.his.blob && rigs.his.blob.material.dispose();
    ['her', 'his'].forEach((k) => {
      const rg = rigs[k];
      if (rg.engrave) { rg.engrave.geometry.dispose(); rg.engrave.material.dispose(); }
      if (rg.engraveTex) rg.engraveTex.dispose();
      (rg.seats || []).forEach((m) => m.geometry.dispose());
      rg.seatMat.dispose();
      if (rg.gemMat) rg.gemMat.dispose();
    });
    contactTex.dispose();
    glowTex.dispose();
    ground.material.dispose();
    ground.geometry.dispose();
    gemGeo.dispose();
    if (diamondEnvRT) diamondEnvRT.dispose();
    envRT.texture.dispose();
    pmrem.dispose();
    renderer.dispose();
  }

  function setSolo(key) {
    soloKey = (key === 'her' || key === 'his') ? key : null;
    applySolo();
    invalidate(30);
  }

  return {
    setState, resize, dispose, screenshot, zoom, reset, setAutoRotate, setSolo, controls, renderer,
    debug: debugApi, // temporary — see comment above debugApi's definition
  };
}

window.ZSCScene = { create };
document.dispatchEvent(new Event('zsc:scene-ready'));
