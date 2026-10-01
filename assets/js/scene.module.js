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
  //     gives the classic arrows pattern). The gold keeps its soft studio —
  //     the soft studio was the root cause of the flat look (#69/#70).
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
  const MAX_HOLES = 8;

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
    // Flush-set stone seats (decisions #73): per hole vec4(axis.x, axis.z,
    // widthPos, radius) in band-local space + the radial depth below which
    // nothing is cut (keeps the inner wall intact).
    mat.userData.holes = {
      count: 0,
      list: Array.from({ length: MAX_HOLES }, () => new THREE.Vector4()),
      z: new Array(MAX_HOLES).fill(1e6),
    };
    mat.onBeforeCompile = (shader) => {
      shader.uniforms.uHoleCount = { value: mat.userData.holes.count };
      shader.uniforms.uHoles = { value: mat.userData.holes.list };
      shader.uniforms.uHoleZ = { value: mat.userData.holes.z };
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
        .replace('#include <common>', '#include <common>\nattribute float aBandY;\nvarying float vShadeWorldY;\nvarying float vBandY;\nvarying vec3 vBandLocal;')
        .replace('#include <begin_vertex>', '#include <begin_vertex>\nvShadeWorldY = (modelMatrix * vec4(transformed, 1.0)).y;\nvBandY = aBandY;\nvBandLocal = position;');
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>',
          '#include <common>\nvarying float vShadeWorldY;\nvarying float vBandY;\nuniform float uShadeMinY;\nuniform float uShadeMaxY;\nuniform float uShadeStrength;'
          + '\nuniform float uZoneCount;\nuniform vec3 uColorA;\nuniform vec3 uColorB;\nuniform vec3 uColorC;\nuniform float uStop1;\nuniform float uStop2;'
          + '\nvarying vec3 vBandLocal;\nuniform int uHoleCount;\nuniform vec4 uHoles[' + MAX_HOLES + '];\nuniform float uHoleZ[' + MAX_HOLES + '];')
        .replace('void main() {',
          'void main() {\n  for (int i = 0; i < ' + MAX_HOLES + '; i++) {\n    if (i >= uHoleCount) break;\n'
          + '    vec4 h = uHoles[i];\n    float sAx = vBandLocal.x * h.x + vBandLocal.z * h.y;\n'
          + '    vec3 q = vBandLocal - vec3(h.x * sAx, h.z, h.y * sAx);\n'
          + '    if (sAx > uHoleZ[i] && dot(q, q) < h.w * h.w) discard;\n  }')
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
      metalness: 1.0, roughness: 0.08, envMap: envRT.texture, envMapIntensity: 1.2, // Round 17: client re-tuned via ?zscdebug=1 (was 1.5)
      side: THREE.DoubleSide,
    });
    attachBottomShade(mat);
    // Seat wall of the flush setting — same metal, a touch rougher (drilled +
    // burnished). Colour follows the band every frame (see loop()).
    const seatMat = new THREE.MeshPhysicalMaterial({
      color: new THREE.Color('#D9A945'), metalness: 1.0, roughness: 0.22,
      envMap: envRT.texture, envMapIntensity: 0.9, side: THREE.DoubleSide,
    });
    return {
      key, root, mat, seatMat, gemMat: null, stones: [], seats: [], band: null, stone: null, outer: 8,
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
    g.setIndex(idx);
    g.computeVertexNormals();
    return g;
  }

  function setHoles(rig, holes) {
    const H = rig.mat.userData.holes;
    H.count = Math.min(holes.length, MAX_HOLES);
    for (let i = 0; i < MAX_HOLES; i++) {
      const h = holes[i];
      if (h) { H.list[i].set(h.ax, h.az, h.w, h.r); H.z[i] = h.z; } else { H.z[i] = 1e6; }
    }
    const sh = rig.mat.userData.shader;
    if (sh && sh.uniforms.uHoleCount) sh.uniforms.uHoleCount.value = H.count;
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
    rig.gemMat.uniforms.uSeatColor.value.copy(rig.mat.color).multiplyScalar(0.55);
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
      rig.seatMat.color.copy(rig.mat.color);
      if (rig.gemMat) rig.gemMat.uniforms.uSeatColor.value.copy(rig.mat.color).multiplyScalar(0.55);
      // Grooves are part of the band geometry now, so they follow for free.
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
    [rigs.her.mat, rigs.his.mat, rigs.her.seatMat, rigs.his.seatMat].forEach((m) => {
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
