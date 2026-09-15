/*
 * ZS Configurator — real-time 3D scene (Faza 2 + premium-look pass).
 *
 * Procedural wedding band: a cross-section profile revolved around the finger
 * axis (LatheGeometry). Driven live by width / thickness / size / profile.
 * MeshPhysicalMaterial from the client's V-Ray-derived PBR values. Studio
 * reflections via RoomEnvironment (its 6 decorative "furniture" boxes
 * stripped out in buildStudio() below — they reflected as sharp diamond/
 * kite-shaped highlights on the metal; the room walls + its 6 real area
 * lights stay, client liked those) + PMREM. frameloop = "demand".
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
  her: {
    rot: new THREE.Euler(-1.6057029118347832, 0.13962634015954636, 0.3141592653589793), // roll 18°, tuned via ?zscdebug=1 — final
    off: new THREE.Vector3(0, 0, -0.25),
  },
  his: {
    rot: new THREE.Euler(-1.5707963267948966, 0.13962634015954636, 0),
    off: new THREE.Vector3(0.5, 0, 0.5),
  },
};
const ZERO = new THREE.Vector3(0, 0, 0);

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

function create(canvas, opts = {}) {
  const pairMode = !!opts.pair;
  const host = canvas.parentElement;
  const renderer = new THREE.WebGLRenderer({
    canvas, antialias: true, alpha: true, powerPreference: 'high-performance',
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
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
    envOffsetY: 7, // "height of the ring within the studio" (see note above) — v1 client-tuned value
    floor: 1.6,
    key: { x: 7, y: 8, z: 8, w: 16, h: 10, power: 4.2 },
    fill: { x: -9, y: 5, z: 3, w: 14, h: 11, power: 2.1 },
    back: { x: -4, y: 6, z: -10, w: 20, h: 16, power: 1.3 },
    blur: 0.12, // blurrier → creamier, less "busy" reflections
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
  // Rebuilt 2026-09-10 (client: the old stone was "samo bela tačkica"; target
  // = the competitor's 4-prong raised solitaire on konfigurator.breuning.de).
  // Every choice here is driven by ONE hard constraint: it must read as a
  // faceted gem on SOFTWARE GL too. The WSL dev box runs SwiftShader, which
  // renders NO transmission / dispersion / thickness refraction — so the
  // "diamond look" can NOT lean on those. It comes from:
  //   (a) non-indexed geometry → computeVertexNormals() gives every facet its
  //       OWN flat normal, so each one mirrors the studio env at a different
  //       angle = real facet-to-facet contrast even with zero refraction;
  //   (b) baked vertex colours — light crown, progressively darker pavilion
  //       into a near-black culet = a fake "looking down through the stone"
  //       depth cue, the only one that survives without refraction;
  //   (c) an optional additive sparkle sprite (how real jewellery
  //       configurators fake "it twinkles" in a soft-box studio).
  // transmission / dispersion are kept LOW here and only add a bonus on a
  // real GPU — they are never the primary read. All of these are live-tunable
  // via the ?zscdebug=1 panel → stoneParams below.
  let stoneParams = {
    // geometry (unit stone: girdle circle r=0.5 at y=0, table at +crownH,
    // culet at -pavD; buildStoneFor scales by the mm Ø). Real round-brilliant
    // total depth ≈ 0.60× Ø → crownH + pavD ≈ 0.60 for a natural silhouette.
    tableRatio: 0.53,        // table Ø / girdle Ø
    crownH: 0.16,            // crown height  (× girdle radius)
    pavD: 0.40,              // pavilion depth (× girdle radius)
    prominence: 1.9,         // stone mm → scene units (burma stones read big)
    raise: 0.05,             // girdle plane height above band surface (× pavD × scale) — near-flush (Round 14): the pavilion sits inside the solid band, only the crown shows
    // material — tuned for SOFTWARE GL first (see note above sharedStoneMat):
    // low transmission + modest env so the baked facet colours actually read
    // instead of washing to a white blob. A real GPU can push these up via
    // the ?zscdebug=1 "Fotorealan" preset.
    envMapIntensity: 1.15, transmission: 0.03, roughness: 0.16, ior: 2.4,
    clearcoat: 0.25, clearcoatRoughness: 0.2,
    iridescence: 0.12, iridescenceIOR: 1.3, dispersion: 4.0,
    // baked facet colours (the depth cue) — cool greys, deliberately NOT
    // near-white: on software GL a smooth dielectric reflects the white studio
    // broadly, so the colours have to be dark enough that facet-to-facet
    // contrast still reads through that reflection
    colTable: '#93a3af', colCrown: '#c0ccd4', colGirdle: '#a7b5bf',
    colPav: '#70808d', colCulet: '#333f4a',
    // sparkle sprites — Round 14 (2026-09-15, client: "poseban efekat
    // svetlucavosti"): bumped from one faint centred glint to two brighter,
    // off-centre ones (see makeStoneUnit) — a single dead-centre highlight
    // reads as a static white dot, real "fire" is 2+ point-glints catching
    // DIFFERENT facets at once.
    sparkle: true, sparkleScale: 1.6, sparkleOpacity: 0.6,
  };

  const sharedStoneMat = new THREE.MeshPhysicalMaterial({
    vertexColors: true, color: 0xffffff, metalness: 0,
    roughness: stoneParams.roughness, ior: stoneParams.ior, thickness: 0.5,
    transmission: stoneParams.transmission, specularIntensity: 1,
    clearcoat: stoneParams.clearcoat, clearcoatRoughness: stoneParams.clearcoatRoughness,
    iridescence: stoneParams.iridescence, iridescenceIOR: stoneParams.iridescenceIOR,
    iridescenceThicknessRange: [120, 480], dispersion: stoneParams.dispersion,
    envMap: envRT.texture, envMapIntensity: stoneParams.envMapIntensity,
    transparent: true, side: THREE.DoubleSide,
  });

  // Additive sparkle sprite — a white core + a faint 4-point star flare,
  // always facing the camera. Shared texture/material; one Sprite per stone.
  function makeSparkleTexture() {
    const c = document.createElement('canvas'); c.width = c.height = 128;
    const x = c.getContext('2d'), cx = 64;
    const g = x.createRadialGradient(cx, cx, 0, cx, cx, 46);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.22, 'rgba(255,255,255,.5)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = g; x.beginPath(); x.arc(cx, cx, 46, 0, Math.PI * 2); x.fill();
    for (let i = 0; i < 2; i++) {
      x.save(); x.translate(cx, cx); x.rotate(i * Math.PI / 4); x.lineWidth = 2;
      [1, -1].forEach((dir) => {
        const grd = x.createLinearGradient(0, 0, dir * 62, 0);
        grd.addColorStop(0, 'rgba(255,255,255,.85)');
        grd.addColorStop(1, 'rgba(255,255,255,0)');
        x.strokeStyle = grd; x.beginPath(); x.moveTo(0, 0); x.lineTo(dir * 62, 0); x.stroke();
      });
      x.restore();
    }
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }
  const sparkleTex = makeSparkleTexture();
  const sparkleMat = new THREE.SpriteMaterial({
    map: sparkleTex, color: 0xffffff, blending: THREE.AdditiveBlending,
    depthWrite: false, transparent: true, opacity: stoneParams.sparkleOpacity,
  });

  // Client (2026-09-05): the flat base gold colour reads as plain/generic
  // "yellow paint" wherever the environment isn't contributing a highlight,
  // and asked for a fake ground-shadow-style darkening toward the ring's
  // bottom for a more grounded 3D read (real product-photography cheat, not
  // physically real AO). Three.js has no built-in "darken by world height"
  // input, so this hooks the compiled shader directly: a varying carries
  // each fragment's world-space Y, and a small multiply against a per-rig
  // uShadeMinY/uShadeMaxY range (set from that ring's own real vertical
  // extent in buildBandFor below, so it's always exactly bottom→top of THAT
  // ring regardless of size) darkens toward the bottom by uShadeStrength.
  // Also wires up the Materijal "Dve boje"/"Tri boje" multi-colour band
  // (client, 2026-09-07, decisions.md #34→real): a custom per-vertex
  // `aBandY` attribute (set in buildBandFor, one float = that vertex's
  // LOCAL width-axis position, i.e. the same coordinate profilePoints()
  // already uses) lets the fragment shader pick a zone colour BEFORE the
  // metal/specular math runs (right after <color_fragment>, so reflections
  // pick up the right tint per zone too — swapping the colour only in the
  // final gl_FragColor, like the bottom-shade trick below does, would leave
  // gold-tinted specular highlights sitting on a silver base). Only straight
  // width-ratio splits (1:1, 1:2, 2:1…) are done this way — patterns needing
  // a per-angle coordinate (wave/diagonal/segment/axial) aren't implemented
  // yet (configurator.js's colorZonesFor() returns null for those, which
  // keeps uZoneCount at 0 here = ordinary single-colour material).
  function attachBottomShade(mat) {
    mat.userData.bottomShade = { minY: -10, maxY: 10, strength: 0 };
    mat.userData.colorZones = { count: 0, colors: [new THREE.Color(), new THREE.Color(), new THREE.Color()], stop1: 0, stop2: 0 };
    mat.onBeforeCompile = (shader) => {
      shader.uniforms.uShadeMinY = { value: mat.userData.bottomShade.minY };
      shader.uniforms.uShadeMaxY = { value: mat.userData.bottomShade.maxY };
      shader.uniforms.uShadeStrength = { value: mat.userData.bottomShade.strength };
      shader.uniforms.uZoneCount = { value: mat.userData.colorZones.count };
      shader.uniforms.uColorA = { value: mat.userData.colorZones.colors[0] };
      shader.uniforms.uColorB = { value: mat.userData.colorZones.colors[1] };
      shader.uniforms.uColorC = { value: mat.userData.colorZones.colors[2] };
      shader.uniforms.uStop1 = { value: mat.userData.colorZones.stop1 };
      shader.uniforms.uStop2 = { value: mat.userData.colorZones.stop2 };
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nattribute float aBandY;\nvarying float vShadeWorldY;\nvarying float vBandY;')
        .replace('#include <begin_vertex>', '#include <begin_vertex>\nvShadeWorldY = (modelMatrix * vec4(transformed, 1.0)).y;\nvBandY = aBandY;');
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>',
          '#include <common>\nvarying float vShadeWorldY;\nvarying float vBandY;\nuniform float uShadeMinY;\nuniform float uShadeMaxY;\nuniform float uShadeStrength;'
          + '\nuniform float uZoneCount;\nuniform vec3 uColorA;\nuniform vec3 uColorB;\nuniform vec3 uColorC;\nuniform float uStop1;\nuniform float uStop2;')
        .replace('#include <color_fragment>',
          '#include <color_fragment>\nif (uZoneCount > 1.5) {\n  vec3 zsColor = (vBandY > uStop1) ? uColorB : uColorA;\n'
          + '  if (uZoneCount > 2.5 && vBandY > uStop2) zsColor = uColorC;\n  diffuseColor.rgb = zsColor;\n}')
        .replace('#include <dithering_fragment>',
          'float shadeT = clamp((vShadeWorldY - uShadeMinY) / max(uShadeMaxY - uShadeMinY, 0.0001), 0.0, 1.0);\n'
          + 'gl_FragColor.rgb *= mix(1.0 - uShadeStrength, 1.0, shadeT);\n#include <dithering_fragment>');
      mat.userData.shader = shader;
    };
  }
  // Pushes configurator.js's `colorZones` (or null) onto a rig's material.
  // `zones` = { colors: [hex,...], stops: [mm,...] } | null.
  function applyColorZones(mat, zones) {
    const cz = mat.userData.colorZones;
    const count = zones ? zones.colors.length : 0;
    cz.count = count;
    if (zones) {
      zones.colors.forEach((hex, i) => cz.colors[i].set(hex));
      cz.stop1 = zones.stops[0] || 0;
      cz.stop2 = zones.stops[1] || 0;
    }
    if (mat.userData.shader) {
      mat.userData.shader.uniforms.uZoneCount.value = count;
      mat.userData.shader.uniforms.uStop1.value = cz.stop1;
      mat.userData.shader.uniforms.uStop2.value = cz.stop2;
      // uColorA/B/C uniforms already point at cz.colors[i] (same Color
      // instances, mutated above) — no reassignment needed.
    }
  }

  function makeRig(key) {
    const root = new THREE.Group();
    scene.add(root);
    const mat = new THREE.MeshPhysicalMaterial({
      color: new THREE.Color('#D9A945'),
      metalness: 1.0, roughness: 0.08, envMap: envRT.texture, envMapIntensity: 1.5,
      side: THREE.DoubleSide,
    });
    attachBottomShade(mat);
    // Metal for the diamond's flush-set rim. Its own material (not `mat`) so
    // it can be a touch rougher/duller than the polished band and skip the
    // band's bottom-shade shader; loop() copies the band's (tweening) colour
    // into it every frame, same trick the grooves use.
    const stoneMetal = new THREE.MeshPhysicalMaterial({
      color: new THREE.Color('#D9A945'), metalness: 1.0, roughness: 0.14,
      envMap: envRT.texture, envMapIntensity: 1.3, side: THREE.DoubleSide,
    });
    return {
      key, root, mat, stoneMetal, band: null, stone: null, outer: 8,
      blob: pairMode ? makeContactBlob() : null,
      target: { color: new THREE.Color('#D9A945'), roughness: 0.08 },
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
    // Materijal multi-colour shader hook (attachBottomShade/applyColorZones)
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
    // Feed this ring's own real, final vertical extent to its bottom-shade
    // shader hook (attachBottomShade above) — always exactly this ring's
    // bottom→top, self-correcting on every rebuild regardless of size.
    if (rig.mat.userData.shader) {
      rig.mat.userData.shader.uniforms.uShadeMinY.value = contact.minY + lift;
      rig.mat.userData.shader.uniforms.uShadeMaxY.value = contact.maxY + lift;
    }
    rig.mat.userData.bottomShade.minY = contact.minY + lift;
    rig.mat.userData.bottomShade.maxY = contact.maxY + lift;
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

  // Faceted round-brilliant gem geometry — non-indexed so
  // computeVertexNormals() bakes one flat normal per facet (see the big note
  // above sharedStoneMat). Carries a per-vertex `color` attribute: light
  // crown → darker pavilion → near-black culet, the fake "depth through the
  // stone" cue. Rebuilt (not just re-scaled) whenever a stoneParams
  // geometry/colour knob changes — cheap, ~230 tris.
  //
  // Round 14 (2026-09-15, client: "model dijamanta nije baš kao pravi"): the
  // crown used to be a perfectly uniform 16-gon — every one of the 16 star
  // facets identical, reading as a plain even pinwheel from above. A real
  // round brilliant alternates 8 LARGER bezel/main facets with 8 SMALLER
  // star facets (the classic 8-point star you see looking down into a
  // diamond) — so the star ring's radius now zigzags out/in every other
  // vertex (rStarOut/rStarIn) instead of sitting at one fixed radius,
  // producing that alternation with the same N=16 wedge count.
  function makeBrilliantGeometry() {
    const N = 16, phase = 0;
    const P = stoneParams;
    const rG = 0.5, rT = rG * P.tableRatio;
    const rStarOut = rG * (P.tableRatio + (1 - P.tableRatio) * 0.62); // bezel-facet corner
    const rStarIn = rG * (P.tableRatio + (1 - P.tableRatio) * 0.36);  // star-facet point
    const rPav = rG * 0.55;                                       // pavilion-main mid ring
    const yT = P.crownH, yStar = P.crownH * 0.5, yGt = 0.035, yGb = -0.035;
    const yPav = -P.pavD * 0.52, yC = -P.pavD;
    const cT = new THREE.Color(P.colTable), cC = new THREE.Color(P.colCrown),
      cG = new THREE.Color(P.colGirdle), cP = new THREE.Color(P.colPav),
      cU = new THREE.Color(P.colCulet);
    const pos = [], col = [];
    const V = (r, y, i) => { const a = phase + (i / N) * Math.PI * 2; return [Math.cos(a) * r, y, Math.sin(a) * r]; };
    const starV = (i, y) => V(i % 2 === 0 ? rStarOut : rStarIn, y, i);
    const tri = (a, b, c, ca, cb, cc) => {
      pos.push(a[0], a[1], a[2], b[0], b[1], b[2], c[0], c[1], c[2]);
      col.push(ca.r, ca.g, ca.b, cb.r, cb.g, cb.b, cc.r, cc.g, cc.b);
    };
    const TC = [0, yT, 0], CU = [0, yC, 0];
    for (let i = 0; i < N; i++) {
      const t0 = V(rT, yT, i), t1 = V(rT, yT, i + 1);
      const s0 = starV(i, yStar), s1 = starV(i + 1, yStar);
      const gt0 = V(rG, yGt, i), gt1 = V(rG, yGt, i + 1);
      const gb0 = V(rG, yGb, i), gb1 = V(rG, yGb, i + 1);
      const p0 = V(rPav, yPav, i), p1 = V(rPav, yPav, i + 1);
      tri(TC, t0, t1, cT, cC, cC);                                  // table (fan)
      tri(t0, s0, s1, cC, cC, cC); tri(t0, s1, t1, cC, cC, cC);     // star facets
      tri(s0, gt0, gt1, cC, cG, cG); tri(s0, gt1, s1, cC, cG, cC);  // bezel/upper-girdle
      tri(gt0, gb0, gb1, cG, cG, cG); tri(gt0, gb1, gt1, cG, cG, cG); // girdle band
      tri(gb0, p0, p1, cG, cP, cP); tri(gb0, p1, gb1, cG, cP, cG);  // pavilion upper
      tri(p0, CU, p1, cP, cU, cP);                                  // pavilion → culet
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    g.computeVertexNormals();
    return g;
  }
  let brilliantGeo = makeBrilliantGeometry();

  // --------------------------------------------------------- krunica/setting
  //
  // Round 14 (2026-09-15): client dropped every prong/carree/bezel-frame
  // setting from Round 10 — "skidamo one kandže, ostavljamo samo ovako nešto
  // ništa više od toga kao na wamagold-u", pointing at wamagold-configurator
  // .com's "Diamonds" step with its flush/"Rubbed" look selected (no claws
  // at all, just the stone with a thin rim of metal at the girdle). Down to
  // ONE setting: FLUSH_SETTING below. `raise` in stoneParams also dropped
  // from 0.6 (raised, prong-bridged) to ~0 (girdle sits AT the band surface)
  // — the pavilion end simply sits inside the solid band mesh, which hides
  // it from every camera angle exactly like a real flush-set stone; no
  // carved seat needed. Built in UNIT-STONE space (girdle r=0.5 at y=0) so
  // buildStoneFor's uniform scale/position/rotation of the whole stone Group
  // carries it along. Uses the rig's stoneMetal so it always matches the
  // band colour/finish (loop() copies the colour in every frame, same trick
  // the grooves use).
  const FLUSH_SETTING = 'flush';

  // The real "flush set" technique: metal rubbed/burnished over the girdle
  // edge, reading as a thin bright rim — nothing raised, nothing prong-held.
  function buildFlushRim(g, metal) {
    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.035, 8, 24), metal);
    rim.rotation.x = Math.PI / 2;
    g.add(rim);
  }
  function makeSettingGroup(metal) {
    const g = new THREE.Group();
    buildFlushRim(g, metal);
    return g;
  }

  // Disposes only the geometries owned by a setting-group Mesh tree — never
  // called on the gem (shared brilliantGeo) or the sparkle Sprite (shared
  // plane geometry), both pooled across every stone unit.
  function disposeSettingGroup(grp) {
    if (!grp) return;
    grp.traverse((o) => { if (o.isMesh && o.geometry) o.geometry.dispose(); });
  }

  // One pooled stone "unit" = gem mesh + setting group + sparkle sprite,
  // under a Group that buildStoneFor positions/rotates/scales as a whole.
  // Only one setting exists now (FLUSH_SETTING) so a unit never needs
  // rebuilding once made — ensureStoneUnit just lazily creates it.
  function makeStoneUnit(rig) {
    const unit = new THREE.Group();
    const gem = new THREE.Mesh(brilliantGeo, sharedStoneMat);
    gem.renderOrder = 3;
    unit.add(gem);
    const settingGroup = makeSettingGroup(rig.stoneMetal);
    unit.add(settingGroup);
    // Two glints, not one: a single dead-centre sprite reads as a static
    // white dot; two smaller ones offset toward different facets read as
    // catching the light at once — closer to real diamond "fire".
    const sparkles = [
      { x: 0, z: 0, s: 1 }, { x: 0.22, z: 0.16, s: 0.6 },
    ].map(({ x, z, s }) => {
      const spr = new THREE.Sprite(sparkleMat);
      spr.position.set(x, stoneParams.crownH * 0.85, z);
      spr.userData.baseScale = s;
      spr.renderOrder = 4;
      spr.visible = stoneParams.sparkle;
      unit.add(spr);
      return spr;
    });
    unit.userData = { gem, sparkle: sparkles, settingGroup };
    return unit;
  }
  function ensureStoneUnit(rig, i) {
    let u = rig.stones[i];
    if (u) return u;
    u = makeStoneUnit(rig);
    rig.root.add(u);
    rig.stones[i] = u;
    return u;
  }
  const _stoneUp = new THREE.Vector3(0, 1, 0);
  const _stoneOut = new THREE.Vector3();

  // state.stone = { mm, positions: [mm along band, ...], widthPos }.
  // "Količina"/"Pozicioniranje" UI choices resolve to the `positions` list
  // before this sees it; this just places whatever it's given. `position`
  // (singular) is still accepted as single-stone shorthand.
  function buildStoneFor(key, state) {
    const rig = rigs[key];
    const s = state.stone;
    const positions = s && s.mm ? (s.positions || [typeof s.position === 'number' ? s.position : 0]) : [];
    const n = positions.length;
    if (!rig.stones) rig.stones = [];
    for (let i = 0; i < n; i++) ensureStoneUnit(rig, i);
    rig.stones.forEach((u, i) => { if (u) u.visible = i < n; }); // nulled slots: dbg.rebuildStone() rebuild pass
    if (!n) return;

    const P = stoneParams;
    const size = state.size || 54;
    const innerR = size / (2 * Math.PI);
    const thickness = state.thickness || 1.4;
    const outerR = innerR + thickness;
    const meanCirc = Math.PI * (innerR + outerR);
    // Flush setting (Round 14): the girdle plane sits `raise·pavD·scale` above
    // the band's outer surface — raise is near-zero now, so the girdle sits
    // right AT the surface and the pavilion (culet-ward) simply sits inside
    // the solid band mesh, hidden from every angle like a real flush stone.
    // Clamp scale so a big stone on a thin band still reads sensibly rather
    // than dwarfing it.
    const maxScale = Math.max(0.6, thickness * 2.2);
    const scale = Math.min(s.mm * P.prominence, maxScale);
    const girdleR = outerR + P.raise * P.pavD * scale;
    const widthPos = s.widthPos || 0;
    positions.forEach((posMm, i) => {
      const u = rig.stones[i];
      u.scale.setScalar(scale);
      (u.userData.sparkle || []).forEach((spr) => spr.scale.setScalar(P.sparkleScale * spr.userData.baseScale));
      const theta = ((posMm || 0) / meanCirc) * Math.PI * 2;   // 0 = +Z
      _stoneOut.set(Math.sin(theta), 0, Math.cos(theta));      // radial outward
      u.position.set(_stoneOut.x * girdleR, widthPos, _stoneOut.z * girdleR);
      u.quaternion.setFromUnitVectors(_stoneUp, _stoneOut);    // table faces outward
    });
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
    if (state.materialColor) rig.target.color.set(state.materialColor);
    if (typeof state.roughness === 'number') rig.target.roughness = state.roughness;
    if (typeof state.envIntensity === 'number') rig.mat.envMapIntensity = state.envIntensity;
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

  function invalidate(frames = 45) {
    dirty = Math.max(dirty, frames);
    if (!running) { running = true; requestAnimationFrame(loop); }
  }
  function loop() {
    dirty--;
    // material easing, both rigs
    ['her', 'his'].forEach((k) => {
      const rig = rigs[k];
      rig.mat.color.lerp(rig.target.color, 0.09);
      rig.mat.roughness += (rig.target.roughness - rig.mat.roughness) * 0.09;
      // Diamond flush-rim tracks the band's (tweening) colour each frame
      // (grooves are part of the band geometry now, so they follow for free).
      rig.stoneMetal.color.copy(rig.mat.color);
    });
    const moving = controls.update();       // true while damping / auto-rotating
    renderer.render(scene, camera);
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
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
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
  // positions/power/floor/blur) and re-points every material's envMap at the
  // fresh texture — a real render-target rebuild, heavier than the other
  // debug knobs, but still cheap for a handful of flat planes; fine to call
  // on every slider drag. Disposes the old render target.
  function rebuildEnvironment() {
    const old = envRT;
    envRT = pmrem.fromScene(buildStudio(), studioParams.blur);
    scene.environment = envRT.texture;
    [rigs.her.mat, rigs.his.mat, rigs.her.stoneMetal, rigs.his.stoneMetal, sharedStoneMat].forEach((m) => {
      m.envMap = envRT.texture;
      m.needsUpdate = true;
    });
    old.dispose();
    invalidate(20);
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
    // ringKey is 'her', 'his', or 'both'. Both mat.color AND target.color
    // must be set together — the render loop lerps mat.color toward
    // target.color every frame (see loop()'s material-tween), so setting
    // only mat.color would get silently animated back within a few frames.
    setColor(ringKey, hex) {
      (ringKey === 'both' ? ['her', 'his'] : [ringKey]).forEach((k) => {
        rigs[k].mat.color.set(hex);
        rigs[k].target.color.set(hex);
      });
      invalidate(30);
    },
    setClearcoat(ringKey, { clearcoat, clearcoatRoughness } = {}) {
      (ringKey === 'both' ? ['her', 'his'] : [ringKey]).forEach((k) => {
        const m = rigs[k].mat;
        if (typeof clearcoat === 'number') m.clearcoat = clearcoat;
        if (typeof clearcoatRoughness === 'number') m.clearcoatRoughness = clearcoatRoughness;
      });
      invalidate(20);
    },
    setShadeStrength(ringKey, v) {
      (ringKey === 'both' ? ['her', 'his'] : [ringKey]).forEach((k) => {
        const m = rigs[k].mat;
        m.userData.bottomShade.strength = v;
        if (m.userData.shader) m.userData.shader.uniforms.uShadeStrength.value = v;
      });
      invalidate(20);
    },
    getShadeStrength: (ringKey) => rigs[ringKey].mat.userData.bottomShade.strength,

    // ---- diamond (?zscdebug=1 "Dijamant" sections) --------------------
    // The panel mutates stoneParams in place, then calls one of these to push
    // the change into the live scene. setStoneMat = cheap material uniforms;
    // rebuildStone = regenerate geometry (needed for shape + baked colours);
    // setSparkle = the additive sprite.
    stoneParams,
    setStoneMat() {
      const m = sharedStoneMat, P = stoneParams;
      m.transmission = P.transmission;
      m.roughness = P.roughness;
      m.ior = P.ior;
      m.envMapIntensity = P.envMapIntensity;
      m.clearcoat = P.clearcoat;
      m.clearcoatRoughness = P.clearcoatRoughness;
      m.iridescence = P.iridescence;
      m.iridescenceIOR = P.iridescenceIOR;
      if ('dispersion' in m) m.dispersion = P.dispersion;
      m.needsUpdate = true;
      invalidate(20);
    },
    rebuildStone() {
      // Geometry knobs (tableRatio/crownH/pavD/…) affect the gem AND the
      // flush rim's placement, so the gem geometry is rebuilt and every
      // pooled unit is force-rebuilt (not just re-scaled) — cheap, this only
      // runs from the ?zscdebug=1 panel, never per-frame.
      const oldB = brilliantGeo;
      brilliantGeo = makeBrilliantGeometry();
      ['her', 'his'].forEach((k) => {
        const rig = rigs[k];
        (rig.stones || []).forEach((u, i) => {
          rig.root.remove(u);
          disposeSettingGroup(u.userData.settingGroup);
          rig.stones[i] = null;
        });
        if (rig.last) buildStoneFor(k, rig.last);
      });
      if (oldB) oldB.dispose();
      invalidate(30);
    },
    setSparkle() {
      const P = stoneParams;
      sparkleMat.opacity = P.sparkleOpacity;
      ['her', 'his'].forEach((k) => (rigs[k].stones || []).forEach((u) => {
        (u.userData.sparkle || []).forEach((spr) => {
          spr.visible = P.sparkle;
          spr.scale.setScalar(P.sparkleScale * spr.userData.baseScale);
        });
      }));
      invalidate(20);
    },
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
      rg.stoneMetal.dispose();
      (rg.stones || []).forEach((u) => u.traverse((o) => { if (o.isMesh) o.geometry.dispose(); }));
    });
    contactTex.dispose();
    glowTex.dispose();
    ground.material.dispose();
    ground.geometry.dispose();
    brilliantGeo.dispose();
    sharedStoneMat.dispose();
    sparkleMat.dispose();
    sparkleTex.dispose();
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
