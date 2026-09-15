/*
 * ZS Configurator — frontend UI shell.
 *
 * 2026-09-06 restructure (client round 2, see docs/decisions.md #26+):
 *  - Steps are now Profil · Dimenzije · Materijal · Žlebovi · Dijamanti ·
 *    Gravura (was Model · Materijal · Profil · Širina · Završna obrada ·
 *    Dijamanti · Gravura) — matches the Confmetrix competitor order noted in
 *    docs/reference/competitors.md. "Model" is gone as a user-facing choice;
 *    PROFIL (the 4 cross-section shapes) is now the entry step, shown as
 *    image+text boxes. "Završna obrada" folded into MATERIJAL (surface
 *    dropdown next to the metal swatches, like the reference's "Alloy/color &
 *    surface"). The old persistent left "Model" column is gone entirely —
 *    the 3D viewport now runs from the left edge to the options panel.
 *  - A single derived helper (modelForProfile) still resolves a `model` row
 *    for pricing/fallback purposes ONLY — the user never picks one anymore.
 *    All 4 model rows have basePrice 0 and duplicate the profile group's own
 *    fill factor, so nothing is actually lost by not exposing model choice.
 *  - Each accordion section gets a "Sledeće" footer button (advances to the
 *    next step, same as clicking the next number in the top nav) — the top
 *    nav's active-step highlight is now properly tracked (was hardcoded to
 *    always highlight "Model").
 *  - Per-ring hidden thumbnail 3D scene (initThumbScene/renderModelThumbs)
 *    removed along with the model list it fed — one less hidden WebGL
 *    context, and the Profil step now uses cheap generated SVG cross-section
 *    icons instead (see crossSectionPath below), matching how the
 *    competitor reference itself shows profiles (line art, not renders).
 *
 * The 3D viewport is real-time WebGL (scene.module.js) — this module only
 * builds the surrounding UI shell and pushes state into it.
 *
 * Live weight/price estimate uses the client's jeweller formula:
 *   meanCircumference_mm = size + PI * thickness
 *   area_mm2             = width * thickness * fill
 *   volume_cm3           = area_mm2 * meanCircumference_mm / 1000
 *   weight_g            = volume_cm3 * density(finoća)
 *   ringPrice           = base + weight_g * pricePerGram + finish + diamond + engraving
 *   pairPrice           = ringHer + ringHis
 * Authoritative price is recomputed server-side on inquiry (Faza 5).
 */
(function () {
  'use strict';

  var STEPS = ['Profil', 'Dimenzije', 'Materijal', 'Žlebovi', 'Dijamanti', 'Gravura'];
  var RINGS = [{ key: 'her', label: 'Njena burma' }, { key: 'his', label: 'Njegova burma' }];

  // Fineness (finoća) — client's real catalogue is 14k (585); 18k (750) is the
  // common upsell, matching the Breuning reference's 333/375/585/750 selector.
  // Copies only what genuinely renders: density (→ weight → price) + a slight
  // colour deepening on 18k gold. `dens` is specific gravity g/cm³ by metal
  // slug; `deepen` lerps the swatch colour toward a richer 18k tone.
  var FINOCA = [
    { id: '585', label: '585', sub: '14k', dens: { zuto: 13.07, belo: 12.90, crveno: 13.00 }, deepen: 0 },
    { id: '750', label: '750', sub: '18k', dens: { zuto: 15.55, belo: 15.90, crveno: 15.45 }, deepen: 0.30 }
  ];
  function finocaDef(id) { for (var i = 0; i < FINOCA.length; i++) if (FINOCA[i].id === id) return FINOCA[i]; return FINOCA[0]; }

  // Which state fields each accordion step owns — used by "Primeni na drugu
  // burmu" (client/Breuning: "Einstellung für Ring 1 übernehmen" per step).
  var SECTION_FIELDS = {
    'Profil':    ['profile'],
    'Dimenzije': ['width', 'thickness', 'size', 'autoRatio'],
    'Materijal': ['material', 'finish', 'finoca', 'colorPattern', 'colorSubPattern', 'materialZones'],
    'Žlebovi':   ['grooveTab', 'grooves'],
    'Dijamanti': ['diamond', 'diamondSetting', 'diamondCut', 'diamondQty', 'diamondPosMode', 'diamondPos'],
    'Gravura':   ['engravingText', 'engravingSide']
  };

  // Thin, consistent line-icon set (24x24, stroke=currentColor).
  var ICON_SVG = {
    orbit: '<path d="M20 12a8 8 0 1 1-2.6-5.9"/><path d="M20 4v4h-4"/>',
    reset: '<circle cx="12" cy="12" r="7.2"/><circle cx="12" cy="12" r="1.4" fill="currentColor" stroke="none"/><path d="M12 2.6v2.6M12 18.8v2.6M2.6 12h2.6M18.8 12h2.6"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    minus: '<path d="M5 12h14"/>',
    camera: '<path d="M4 8h3l1.5-2h7L17 8h3a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1Z"/><circle cx="12" cy="13" r="3.2"/>',
    expand: '<path d="M9 4H5a1 1 0 0 0-1 1v4M15 4h4a1 1 0 0 1 1 1v4M9 20H5a1 1 0 0 1-1-1v-4M15 20h4a1 1 0 0 0 1-1v-4"/>',
    heart: '<path d="M12 20s-7-4.35-9.5-8.8C1 8 2.4 5 5.6 5c1.9 0 3.3 1 4.4 2.6C11.1 6 12.5 5 14.4 5 17.6 5 19 8 18.5 11.2 16 15.65 12 20 12 20Z"/>',
    share: '<path d="M12 4v11"/><path d="M8 8l4-4 4 4"/><path d="M5 14v4a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-4"/>',
    chevronRight: '<path d="M9 5l7 7-7 7"/>',
    diamond: '<path d="M12 3.5 5 10l7 10.5L19 10z"/><path d="M5 10h14M9.5 3.5 8 10l4 10.5M14.5 3.5 16 10l-4 10.5"/>',
    eye: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/>',
    copy: '<rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h8"/>',
    plusCircle: '<circle cx="12" cy="12" r="9"/><path d="M12 8v8M8 12h8"/>',
    trash: '<path d="M4 7h16M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2m-9 0 1 13a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-13"/>'
  };
  function icon(name, cls) {
    return '<svg class="zs-icon' + (cls ? ' ' + cls : '') + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" ' +
      'stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + ICON_SVG[name] + '</svg>';
  }

  /* --------------------------------------------------------- cross-section art
   *
   * The client asked (2026-09-06) for our own line-art cross-section icons —
   * softer palette, dash-dot centreline — instead of screenshots. These are
   * generated SVG, not raster images: free, crisp at any size, and (for the
   * Dimenzije step's big diagram) able to actually track the live
   * width/thickness/profile state instead of being a static illustration.
   * Local coordinate system: x in [-w/2, w/2] (ring WIDTH, i.e. finger-axis
   * span), y in [-h/2, h/2] (ring THICKNESS/height), y=-h/2 is the outer
   * (dome) side, y=+h/2 the inner (flat, finger-facing) side — same axes
   * scene.module.js's profilePoints() revolves, just flattened to 2D and
   * without the absolute radius (we only need the LOCAL bump shape here).
   */
  // Parametric cross-section (client, 2026-09-08: "add more profiles like the
  // Breuning site"). One knob-set drives BOTH the 2D line-art here AND the 3D
  // LatheGeometry (scene.module.js gets the sampled outline via sceneStateFor,
  // so the shape a card shows is exactly what renders). Knobs, all 0..1:
  //   dome   — how domed the OUTER face is (0 flat top, 1 half-round)
  //   cham   — 45° bevel on the outer edges (only visible when dome is low)
  //   taper  — inner face narrower than outer (trapezoid / "F"-style)
  //   belly  — side walls bow outward (barrel / oval)
  //   point  — pointed apex on the outer face (knife-edge / marquise)
  //   relief — comfort hollow on the inner (finger-facing) face
  // Outline is normalised: nx in [-1,1] = WIDTH axis, ny in [-1,1] = THICKNESS
  // axis with ny=-1 the outer (dome) side, ny=+1 the inner (finger) side.
  function c01(v) { return Math.max(0, Math.min(1, +v || 0)); }
  function paramProfileOutline(p) {
    p = p || {};
    var dome = c01(p.dome), cham = c01(p.cham), taper = c01(p.taper),
        belly = c01(p.belly), point = c01(p.point), relief = c01(p.relief);
    var wi = 1 - 0.42 * taper;                 // inner half-width (nx)
    var ch = 0.30 * cham;                      // chamfer size (nx & ny)
    var bow = 0.18 * belly;                    // side bows this far past nx=1
    var pts = [];
    function q(a, cp, b, n) {
      for (var i = 1; i <= n; i++) {
        var t = i / n, mt = 1 - t;
        pts.push([mt * mt * a[0] + 2 * mt * t * cp[0] + t * t * b[0],
                  mt * mt * a[1] + 2 * mt * t * cp[1] + t * t * b[1]]);
      }
    }
    // Outer face: corners at nx=±outNx, ny=edgeY; centre reaches the top
    // (ny=-1). dome lifts the corners toward mid-height so the sides curve up
    // into a half-round; point makes a sharp apex instead.
    var pointed = point > 0.02;
    var outNx = pointed ? (1 - point * 0.12) : (dome > 0.02 ? 1 - dome * 0.34 : 1);
    var edgeY = pointed ? (-1 + point * 0.72) : (dome > 0.02 ? (-1 + dome * 0.85) : -1 + ch);

    pts.push([-wi, 1]);                                    // inner face, left
    if (relief > 0.02) q([-wi, 1], [0, 1 - relief * 0.55], [wi, 1], 10);
    else pts.push([wi, 1]);                                // inner face, right
    q([wi, 1], [1 + bow, -0.1], [outNx, edgeY], 12);       // right side
    if (pointed) {                                         // sharp apex
      pts.push([outNx * 0.42, -1 + point * 0.10]);
      pts.push([0, -1]);
      pts.push([-outNx * 0.42, -1 + point * 0.10]);
      pts.push([-outNx, edgeY]);
    } else if (dome > 0.02) {                              // rounded top
      q([outNx, edgeY], [0, -2 - edgeY], [-outNx, edgeY], 20);
    } else {                                               // flat top, bevelled
      pts.push([outNx - ch, -1]);
      pts.push([-(outNx - ch), -1]);
      pts.push([-outNx, edgeY]);
    }
    q([-outNx, edgeY], [-(1 + bow), -0.1], [-wi, 1], 12);  // left side
    return pts;
  }

  function crossSectionPath(shape, w, h, p) {
    var r = Math.min(w, h) * 0.16;
    if (shape === 'param') {
      var o = paramProfileOutline(p), hw = w / 2, hh = h / 2;
      var d = 'M ' + (o[0][0] * hw).toFixed(2) + ' ' + (o[0][1] * hh).toFixed(2);
      for (var i = 1; i < o.length; i++) d += ' L ' + (o[i][0] * hw).toFixed(2) + ' ' + (o[i][1] * hh).toFixed(2);
      return d + ' Z';
    }
    if (shape === 'round') {
      return 'M ' + (-w / 2) + ' 0 A ' + (w / 2) + ' ' + (h / 2) + ' 0 1 0 ' + (w / 2) + ' 0 ' +
        'A ' + (w / 2) + ' ' + (h / 2) + ' 0 1 0 ' + (-w / 2) + ' 0 Z';
    }
    if (shape === 'd-comfort') {
      return 'M ' + (-w / 2) + ' ' + (h / 2) + ' L ' + (-w / 2) + ' 0 ' +
        'A ' + (w / 2) + ' ' + (h / 2) + ' 0 0 1 ' + (w / 2) + ' 0 L ' + (w / 2) + ' ' + (h / 2) + ' Z';
    }
    if (shape === 'court') {
      var ry = h * 0.62, topY = -h * 0.02;
      return 'M ' + (-w / 2) + ' ' + topY + ' A ' + (w / 2) + ' ' + ry + ' 0 0 1 ' + (w / 2) + ' ' + topY + ' ' +
        'L ' + (w / 2) + ' ' + (h / 2 - r) + ' A ' + r + ' ' + r + ' 0 0 1 ' + (w / 2 - r) + ' ' + (h / 2) + ' ' +
        'L ' + (-w / 2 + r) + ' ' + (h / 2) + ' A ' + r + ' ' + r + ' 0 0 1 ' + (-w / 2) + ' ' + (h / 2 - r) + ' Z';
    }
    // 'flat' (ravni) — rounded rectangle
    return 'M ' + (-w / 2 + r) + ' ' + (-h / 2) + ' L ' + (w / 2 - r) + ' ' + (-h / 2) + ' ' +
      'A ' + r + ' ' + r + ' 0 0 1 ' + (w / 2) + ' ' + (-h / 2 + r) + ' L ' + (w / 2) + ' ' + (h / 2 - r) + ' ' +
      'A ' + r + ' ' + r + ' 0 0 1 ' + (w / 2 - r) + ' ' + (h / 2) + ' L ' + (-w / 2 + r) + ' ' + (h / 2) + ' ' +
      'A ' + r + ' ' + r + ' 0 0 1 ' + (-w / 2) + ' ' + (h / 2 - r) + ' L ' + (-w / 2) + ' ' + (-h / 2 + r) + ' ' +
      'A ' + r + ' ' + r + ' 0 0 1 ' + (-w / 2 + r) + ' ' + (-h / 2) + ' Z';
  }

  // Small profile-box icon (Profil step). Fixed illustrative ratio — the
  // point here is "which shape", not the live mm values.
  function profileIconSVG(shape, p) {
    var vw = 96, vh = 64, w = 58, h = 34;
    var d = crossSectionPath(shape, w, h, p);
    return '<svg viewBox="0 0 ' + vw + ' ' + vh + '" class="zs-profile-icon" aria-hidden="true">' +
      '<g transform="translate(' + (vw / 2) + ',' + (vh / 2) + ')">' +
      '<line x1="' + (-w / 2 - 8) + '" y1="0" x2="' + (w / 2 + 8) + '" y2="0" class="zs-cs-axis"/>' +
      '<line x1="0" y1="' + (-h / 2 - 10) + '" x2="0" y2="' + (h / 2 + 10) + '" class="zs-cs-axis"/>' +
      '<path d="' + d + '" class="zs-cs-shape"/>' +
      '</g></svg>';
  }

  // Big interactive diagram (Dimenzije step) — reflects the ring's own live
  // width/thickness ratio for whichever profile is currently selected, with
  // ŠIRINA / VISINA arrows (client's own wording, see reference sketch).
  function bigCrossSectionSVG(shape, widthMm, thicknessMm, p) {
    var vw = 320, vh = 190;
    var maxSpan = 150, ratio = widthMm / Math.max(thicknessMm, 0.1);
    var w, h;
    if (ratio >= 1) { w = maxSpan; h = maxSpan / ratio; } else { h = maxSpan; w = maxSpan * ratio; }
    h = Math.max(h, 26); w = Math.max(w, 40);
    var d = crossSectionPath(shape, w, h, p);
    var cx = vw / 2, cy = vh / 2 - 6;
    var arrowY = cy + h / 2 + 26;
    return '<svg viewBox="0 0 ' + vw + ' ' + vh + '" class="zs-cs-diagram" aria-hidden="true">' +
      '<g transform="translate(' + cx + ',' + cy + ')">' +
      '<line x1="' + (-w / 2 - 16) + '" y1="0" x2="' + (w / 2 + 16) + '" y2="0" class="zs-cs-axis"/>' +
      '<line x1="0" y1="' + (-h / 2 - 14) + '" x2="0" y2="' + (h / 2 + 14) + '" class="zs-cs-axis"/>' +
      '<path d="' + d + '" class="zs-cs-shape zs-cs-shape-big"/>' +
      '</g>' +
      // ŠIRINA — horizontal arrow, below
      '<g class="zs-cs-annot">' +
      '<line x1="' + (cx + w / 2) + '" y1="' + (cy + h / 2 + 6) + '" x2="' + (cx + w / 2) + '" y2="' + arrowY + '" class="zs-cs-lead"/>' +
      '<line x1="' + (cx - w / 2) + '" y1="' + (cy + h / 2 + 6) + '" x2="' + (cx - w / 2) + '" y2="' + arrowY + '" class="zs-cs-lead"/>' +
      '<line x1="' + (cx - w / 2) + '" y1="' + arrowY + '" x2="' + (cx + w / 2) + '" y2="' + arrowY + '" class="zs-cs-arrow" marker-start="url(#zscArrow)" marker-end="url(#zscArrow)"/>' +
      '<text x="' + cx + '" y="' + (arrowY + 16) + '" text-anchor="middle" class="zs-cs-label">ŠIRINA</text>' +
      // VISINA — vertical arrow, to the left
      '<line x1="' + (cx - w / 2 - 12) + '" y1="' + (cy - h / 2) + '" x2="' + (cx - w / 2 - 12) + '" y2="' + (cy + h / 2) + '" class="zs-cs-arrow" marker-start="url(#zscArrow)" marker-end="url(#zscArrow)"/>' +
      '<line x1="' + (cx - w / 2 - 6) + '" y1="' + (cy - h / 2) + '" x2="' + (cx - w / 2 - 18) + '" y2="' + (cy - h / 2) + '" class="zs-cs-lead"/>' +
      '<line x1="' + (cx - w / 2 - 6) + '" y1="' + (cy + h / 2) + '" x2="' + (cx - w / 2 - 18) + '" y2="' + (cy + h / 2) + '" class="zs-cs-lead"/>' +
      '<text x="' + (cx - w / 2 - 24) + '" y="' + cy + '" text-anchor="end" class="zs-cs-label">VISINA</text>' +
      '</g>' +
      '<defs><marker id="zscArrow" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">' +
      '<path d="M1 1 L9 5 L1 9" fill="none" stroke="currentColor" stroke-width="1.6"/></marker></defs>' +
      '</svg>';
  }

  function boot() {
    document.querySelectorAll('script.zs-config-boot').forEach(function (node) {
      var data;
      try { data = JSON.parse(node.textContent); } catch (e) { return; }
      var root = document.getElementById(node.dataset.target);
      if (root) new Configurator(root, data).mount();
    });
  }

  function Configurator(root, boot) {
    this.root = root;
    this.restUrl = boot.restUrl;
    this.assetsUrl = boot.assetsUrl || '';
    this.c = boot.config || {};
    this.activeRing = 'her';
    this.viewSolo = false;
    this._activeStep = STEPS[0];
    // Only the active step is open (client, 2026-09-07, corrected back after
    // a misreading two commits ago: sections OTHER than the current one
    // must be genuinely display:none/gone, not all shown at once — this is
    // a strict step wizard, only "Sledeće" or a top-nav number reveals the
    // next section).
    this.openSections = {};
    this.openSections[STEPS[0]] = true;
    this.state = { her: this.defaultState('her'), his: this.defaultState('his') };
  }

  // her/his get slightly different defaults on purpose (client, 2026-09-06):
  // the starting render should never show two identical-size bands — "her"
  // starts narrower/thinner/smaller, "his" wider/thicker/bigger, like a real
  // wedding-band pair, until the client tunes their own sizes.
  Configurator.prototype.defaultState = function (ringKey) {
    var c = this.c, g = c.groups || {};
    var shank = (c.model && c.model.shank) || {};
    var wCfg = g.width || shank.width || { min: 3, max: 8, step: 0.5, default: 4 };
    var tCfg = g.thickness || shank.thickness || { min: 1, max: 2.5, step: 0.5, default: 1.5 };
    var sCfg = shank.size || { min: 44, max: 68, step: 0.5, default: 54 };
    var delta = ringKey === 'her' ? -1 : (ringKey === 'his' ? 1 : 0);
    return {
      material: firstAvail(g.material),
      profile: firstSlug(g.profile),
      finish: firstAvail(g.finish),
      diamond: 'bez', // client 2026-09-15: ring starts with NO stone — matches
      // competitor default ("Keine"/no diamond group until the customer picks
      // a setting type); was firstAvail(g.diamond), which pre-selected the
      // first stock stone before the customer had chosen anything.
      width: snap(num(wCfg.default, 4) + delta * 1.0, wCfg.min, wCfg.max, wCfg.step || 0.5),
      thickness: snap(num(tCfg.default, 1.5) + delta * 0.5, tCfg.min, tCfg.max, tCfg.step || 0.5),
      size: snap(num(sCfg.default, 54) + delta * 6, sCfg.min, sCfg.max, sCfg.step || 0.5),
      autoRatio: false,
      finoca: '585',
      colorPattern: 'single',
      colorSubPattern: '',
      grooveTab: 0,
      grooves: [],
      diamondSetting: 'none',
      diamondCut: 'brilliant',
      diamondQty: 1,
      diamondPosMode: 'centar',
      diamondPos: 0,
      engravingText: '',
      engravingSide: (g.engraving && g.engraving.defaultSide) || 'inside'
    };
  };

  /* -------------------------------------------------------------------- mount */

  Configurator.prototype.mount = function () {
    var r = this.root;
    r.innerHTML = '';
    r.classList.add('zs-ready');
    r.appendChild(this.buildTopbar());
    r.appendChild(this.buildSteps());
    var shell = el('div', 'zs-shell');
    shell.appendChild(this.buildView());
    shell.appendChild(this.buildPanel());
    r.appendChild(shell);
    var bottombar = this.buildBottombar();
    r.appendChild(bottombar);
    // The bar is `position:fixed` (see configurator.css) so it always stays
    // pinned to the viewport bottom — real content needs matching
    // padding-bottom on the root or the last section sits hidden underneath
    // it. Height varies (bottombar wraps to multiple rows on narrow widths),
    // so measure it live rather than hardcoding one number.
    if (window.ResizeObserver) {
      new ResizeObserver(function (entries) {
        r.style.setProperty('--zs-bottombar-h', Math.ceil(entries[0].contentRect.height) + 'px');
      }).observe(bottombar);
    }
    this.refresh();
    this.initScene();
    window.__zscApp = this; // debug/QA handle (state + sceneStateFor) — harmless, kept for testing
  };

  /* --------------------------------------------------------------- 3D scene */

  Configurator.prototype.initScene = function () {
    var self = this;
    if (this.scene || !this._canvas) return;
    if (window.ZSCScene && window.ZSCScene.create) {
      this.scene = window.ZSCScene.create(this._canvas, { pair: true });
      this._view.classList.add('has-3d');
      this.pushScene();
      // Exposes the app for the ?zscdebug=1 live-tuning panel
      // (assets/js/debug-panel.js, enqueued in Configurator.php under the same
      // query flag). Re-enabled 2026-09-10 for the diamond rebuild pass.
      if (/[?&]zscdebug=/.test(location.search)) window.zscApp = this;
    } else {
      document.addEventListener('zsc:scene-ready', function () { self.initScene(); }, { once: true });
    }
  };

  // Both rings are always shown together in the viewport (matches the
  // competitor "pair" hero shot); the active ring/tab only decides which
  // one the right-hand panel is currently editing.
  Configurator.prototype.sceneStateFor = function (ringKey) {
    var c = this.c, g = c.groups || {}, s = this.state[ringKey];
    var mat = bySlug(g.material, s.material);
    var fin = bySlug(g.finish, s.finish);
    var prof = bySlug(g.profile, s.profile);
    var dia = bySlug(g.diamond, s.diamond);
    var pbr = (mat && mat.params && mat.params.pbr) || {};
    var finPbr = (fin && fin.params && fin.params.pbr) || {};
    var stone = (dia && dia.params && dia.params.mm)
      ? {
          mm: dia.params.mm, positions: diamondPositions(s), widthPos: diamondWidthPos(s),
          setting: s.diamondSetting,
          cut: CARREE_SETTINGS.indexOf(s.diamondSetting) > -1 ? 'carree' : 'round'
        } : null;
    var grooves = (s.grooves || []).map(function (grv) {
      var gfin = bySlug(g.finish, grv.surface);
      var gpbr = (gfin && gfin.params && gfin.params.pbr) || {};
      return {
        shape: grv.shape, width: grv.width, depth: grv.depth, position: grv.position,
        roughness: typeof gpbr.roughness === 'number' ? gpbr.roughness : 0.2
      };
    });
    var profParams = (prof && prof.params) || {};
    // 18k gold reads slightly richer/deeper than 14k — nudge the swatch colour
    // toward a warmer gold by the fineness' `deepen` amount (no-op for 585).
    var fdef = finocaDef(s.finoca);
    var baseColor = pbr.color || '#D9A945';
    var matColor = fdef.deepen > 0 ? mixHex(baseColor, '#C98A2E', fdef.deepen) : baseColor;
    return {
      width: s.width, thickness: s.thickness, size: s.size,
      profileShape: profParams.shape || 'flat',
      profileKey: s.profile,
      profileOutline: profParams.shape === 'param' ? paramProfileOutline(profParams) : null,
      materialColor: matColor,
      roughness: typeof finPbr.roughness === 'number' ? finPbr.roughness : (pbr.roughness || 0.08),
      envIntensity: finPbr.anisotropy ? 1.0 : 1.2,
      stone: stone,
      grooves: grooves,
      colorZones: colorZonesFor(s, g),
      engraving: (s.engravingText || '').trim()
        ? { text: (s.engravingText || '').trim(), side: s.engravingSide || 'inside' } : null
    };
  };

  Configurator.prototype.pushScene = function () {
    if (!this.scene) return;
    this.scene.setState({ her: this.sceneStateFor('her'), his: this.sceneStateFor('his') });
    // setState makes both rings visible again; re-assert any "view solo" state.
    this.applyViewSolo();
  };

  /* ------------------------------------------------------------------- topbar */

  Configurator.prototype.buildTopbar = function () {
    var bar = el('div', 'zs-topbar');
    var full = this.assetsUrl ? this.assetsUrl + 'img/logo-full.png' : '';
    var mark = this.assetsUrl ? this.assetsUrl + 'img/logo-mark.png' : '';
    // Both client logo files go in the header (2026-09-06): the full
    // wordmark on normal widths, the small mark-only version standing in on
    // narrow/mobile widths where the wordmark would get cramped (CSS swap,
    // see .zs-brand-logo-full/-mark in configurator.css).
    bar.innerHTML =
      '<button type="button" class="zs-topbar-back">&larr; Nazad na kolekciju</button>' +
      '<div class="zs-brand">' +
        (full
          ? '<img class="zs-brand-logo-full" src="' + esc(full) + '" alt="Zlatara Stanimirović" height="34">' +
            '<img class="zs-brand-logo-mark" src="' + esc(mark) + '" alt="Zlatara Stanimirović" height="30">'
          : '<span class="zs-brand-mark">' + icon('diamond') + '</span><span class="zs-brand-text"><strong>Zlatara Stanimirović</strong><em>Burme po meri</em></span>') +
      '</div>' +
      '<div class="zs-topbar-actions">' +
        '<button type="button" class="zs-linkbtn">' + icon('heart') + ' Sačuvaj</button>' +
        '<button type="button" class="zs-linkbtn">' + icon('share') + ' Podeli</button>' +
      '</div>';
    return bar;
  };

  Configurator.prototype.buildSteps = function () {
    var nav = el('div', 'zs-steps');
    var self = this;
    STEPS.forEach(function (label, i) {
      var b = el('button', 'zs-step');
      b.type = 'button';
      b.dataset.step = label;
      b.innerHTML = '<span class="zs-step-n">' + (i + 1) + '</span><span class="zs-step-l">' + esc(label) + '</span>';
      b.addEventListener('click', function () { self.gotoStep(label); });
      nav.appendChild(b);
    });
    this._steps = nav;
    return nav;
  };

  Configurator.prototype.gotoStep = function (label) {
    this._activeStep = label;
    // Strict single-open wizard: navigating to a step closes every other
    // one (client, 2026-09-07) — only the target section should exist on
    // the page, not just "also be open alongside whatever else was open".
    this.openSections = {};
    this.openSections[label] = true;
    this.renderPanel();
    this.updateStepsActive();
    // Just reset the OPTIONS PANEL's own scroll to the top — never
    // scrollIntoView(), which scrolled the whole page (client, 2026-09-10:
    // "kad se klikne u navigaciji ne treba da skroluje"). Single-open wizard,
    // so the target section is the only thing rendered anyway.
    if (this._panel) this._panel.scrollTop = 0;
  };

  Configurator.prototype.goNext = function (label) {
    var idx = STEPS.indexOf(label);
    if (idx > -1 && idx + 1 < STEPS.length) this.gotoStep(STEPS[idx + 1]);
  };

  Configurator.prototype.updateStepsActive = function () {
    var self = this;
    this._steps.querySelectorAll('.zs-step').forEach(function (b) {
      b.classList.toggle('is-active', b.dataset.step === self._activeStep);
    });
  };

  /* ----------------------------------------------------------------- viewport */

  Configurator.prototype.buildView = function () {
    var col = el('div', 'zs-col zs-col-view');
    var self = this;

    var stage = el('div', 'zs-view');
    stage.innerHTML =
      '<canvas class="zs-view-canvas"></canvas>' +
      '<div class="zs-view-placeholder">' +
        '<span class="zs-view-mark">' + icon('diamond') + '</span>' +
        '<strong>Učitavanje 3D prikaza…</strong>' +
        '<span>Ako se ne pojavi, proverite da li vaš pregledač podržava WebGL.</span>' +
      '</div>' +
      '<div class="zs-view-rail">' +
        railBtn('rotate', icon('orbit'), 'Auto-rotacija') + railBtn('reset', icon('reset'), 'Resetuj pogled') +
        railBtn('zin', icon('plus'), 'Uvećaj') + railBtn('zout', icon('minus'), 'Umanji') +
      '</div>';
    col.appendChild(stage);
    this._view = stage;
    this._canvas = stage.querySelector('.zs-view-canvas');

    stage.querySelector('.zs-view-rail').addEventListener('click', function (e) {
      var btn = e.target.closest('.zs-rail-btn'); if (!btn || !self.scene) return;
      var k = btn.dataset.k;
      if (k === 'rotate') self.scene.setAutoRotate();
      else if (k === 'reset') self.scene.reset();
      else if (k === 'zin') self.scene.zoom(0.82);
      else if (k === 'zout') self.scene.zoom(1.22);
    });

    var toolbar = el('div', 'zs-view-toolbar');
    // Njegova / Njena as bare ♂ / ♀ symbols (client, 2026-09-08), sitting to
    // the LEFT of the view tools; "his" first, then "her". The eye button
    // isolates whichever ring is active — same camera, the other ring hidden.
    toolbar.innerHTML =
      '<div class="zs-ring-toggle">' +
        '<button type="button" class="zs-ring-btn" data-ring="his" title="Njegova burma" aria-label="Njegova burma">♂</button>' +
        '<button type="button" class="zs-ring-btn" data-ring="her" title="Njena burma" aria-label="Njena burma">♀</button>' +
      '</div>' +
      '<button type="button" class="zs-tool-btn zs-view-solo" data-k="solo" aria-pressed="false" title="Prikaži samo izabranu burmu">' +
        icon('eye') + '</button>' +
      '<span class="zs-tool-sep"></span>' +
      toolBtn(icon('reset'), 'Reset') + toolBtn(icon('orbit'), 'Rotacija') +
      toolBtn(icon('camera'), 'Slika') + toolBtn(icon('expand'), 'Pun ekran');
    this._ringToggle = toolbar.querySelector('.zs-ring-toggle');
    this._soloBtn = toolbar.querySelector('.zs-view-solo');
    toolbar.addEventListener('click', function (e) {
      var ringBtn = e.target.closest('.zs-ring-btn');
      if (ringBtn) { self.setActiveRing(ringBtn.dataset.ring); return; }
      var btn = e.target.closest('.zs-tool-btn'); if (!btn) return;
      if (btn.dataset.k === 'solo') { self.toggleViewSolo(); return; }
      var label = btn.textContent.trim();
      if (label === 'Reset' && self.scene) self.scene.reset();
      else if (label === 'Rotacija' && self.scene) self.scene.setAutoRotate();
      else if (label === 'Slika' && self.scene) { var u = self.scene.screenshot(2); if (u) window.open(u, '_blank'); }
      else if (label === 'Pun ekran') { (stage.requestFullscreen ? stage.requestFullscreen() : 0); }
    });
    col.appendChild(toolbar);

    return col;
  };

  Configurator.prototype.setActiveRing = function (key) {
    if (key !== 'her' && key !== 'his') return;
    this.activeRing = key;
    this.refresh();
  };

  // Copy one step's fields from the active ring onto the other ring.
  Configurator.prototype.copySection = function (label) {
    var fields = SECTION_FIELDS[label]; if (!fields) return;
    var src = this.state[this.activeRing];
    var dst = this.state[this.activeRing === 'her' ? 'his' : 'her'];
    fields.forEach(function (f) {
      var v = src[f];
      dst[f] = (v && typeof v === 'object') ? JSON.parse(JSON.stringify(v)) : v;
    });
    this.recalc();
    this.pushScene();
  };

  // "View solo" = show only the active ring, keeping the exact same camera
  // (client, 2026-09-08: "isti kadar samo bez drugog prstena").
  Configurator.prototype.toggleViewSolo = function () {
    this.viewSolo = !this.viewSolo;
    this.applyViewSolo();
  };

  Configurator.prototype.applyViewSolo = function () {
    if (this._soloBtn) this._soloBtn.setAttribute('aria-pressed', String(!!this.viewSolo));
    if (this.scene && this.scene.setSolo) {
      this.scene.setSolo(this.viewSolo ? this.activeRing : null);
    }
  };

  /* -------------------------------------------------------------------- panel */

  Configurator.prototype.buildPanel = function () {
    var col = el('div', 'zs-col zs-col-panel');
    this._panel = col;
    var self = this;
    col.addEventListener('change', function () { self.recalc(); self.pushScene(); });
    col.addEventListener('input', function () { self.recalc(); });
    return col;
  };

  Configurator.prototype.renderPanel = function () {
    var p = this._panel;
    p.innerHTML = '';
    var s = this.cur(), g = this.c.groups || {};
    p.dataset.ring = this.activeRing;

    p.appendChild(this.section('Profil', 1, this.uiProfile(g, s)));
    p.appendChild(this.section('Dimenzije', 2, this.uiDimenzije(g, s)));
    p.appendChild(this.section('Materijal', 3, this.uiMaterijal(g, s)));
    p.appendChild(this.section('Žlebovi', 4, this.uiGrooves(s)));
    p.appendChild(this.section('Dijamanti', 5, this.uiDiamonds(g, s)));
    p.appendChild(this.section('Gravura', 6, this.uiEngraving(g.engraving, s)));
    this.updateStepsActive();
  };

  /* ------------------------------------------------------------------- Profil */

  Configurator.prototype.uiProfile = function (g, s) {
    var wrap = el('div', 'zs-profile-groups');
    var self = this;
    // Group by params.group (client, 2026-09-08: laid out in labelled groups
    // like the competitor's Profil step); ungrouped rows fall into "Profili".
    var order = [], byGroup = {};
    (g.profile || []).forEach(function (opt) {
      var gk = (opt.params && opt.params.group) || 'Profili';
      if (!byGroup[gk]) { byGroup[gk] = []; order.push(gk); }
      byGroup[gk].push(opt);
    });
    order.forEach(function (gk) {
      var group = el('div', 'zs-profile-group');
      if (order.length > 1) group.appendChild(hx('p', 'zs-eyebrow', gk));
      var grid = el('div', 'zs-profile-grid');
      byGroup[gk].forEach(function (opt) {
        var shape = (opt.params && opt.params.shape) || 'flat';
        var card = el('button', 'zs-profile-box');
        card.type = 'button';
        card.setAttribute('aria-pressed', String(opt.slug === s.profile));
        if (!opt.available) card.disabled = true;
        card.innerHTML = profileIconSVG(shape, opt.params) + '<span class="zs-profile-label">' + esc(opt.label) + '</span>';
        card.addEventListener('click', function () {
          s.profile = opt.slug;
          wrap.querySelectorAll('.zs-profile-box').forEach(function (b) { b.setAttribute('aria-pressed', String(b === card)); });
          self.pushScene(); self.refreshDiagrams(); bubble(card);
        });
        grid.appendChild(card);
      });
      group.appendChild(grid);
      wrap.appendChild(group);
    });
    return wrap;
  };

  /* ---------------------------------------------------------------- Dimenzije */

  Configurator.prototype.uiDimenzije = function (g, s) {
    var box = el('div', 'zs-dimenzije');
    var self = this;

    var diagramWrap = el('div', 'zs-cs-diagram-wrap');
    diagramWrap.appendChild(hx('p', 'zs-eyebrow', 'Presek profila'));
    var diagram = el('div', 'zs-cs-diagram-host');
    diagram.innerHTML = bigCrossSectionSVG(profileShapeOf(g, s.profile), s.width, s.thickness, profileParamsOf(g, s.profile));
    diagramWrap.appendChild(diagram);
    box.appendChild(diagramWrap);
    this._diagramHost = diagram;

    var row = el('div', 'zs-dim-row');
    var wCfg = g.width || { min: 3, max: 8, step: 0.5, unit: 'mm' };
    var tCfg = g.thickness || { min: 1, max: 2.5, step: 0.5, unit: 'mm' };
    var wSlider = slider('Širina', wCfg, s.width, function (v) { s.width = v; self.refreshDiagrams(); });
    var tSlider = slider('Debljina', tCfg, s.thickness, function (v) { s.thickness = v; self.refreshDiagrams(); });
    row.appendChild(wSlider);
    row.appendChild(tSlider);
    box.appendChild(row);

    var auto = el('label', 'zs-check-row');
    auto.innerHTML = '<input type="checkbox"' + (s.autoRatio ? ' checked' : '') + '> ' +
      'Automatski podesi optimalan odnos širine i debljine';
    var autoInput = auto.querySelector('input');
    var applyAutoLock = function () {
      var input = tSlider.querySelector('input[type="range"]');
      input.disabled = !!s.autoRatio;
      tSlider.classList.toggle('is-locked', !!s.autoRatio);
    };
    autoInput.addEventListener('change', function () {
      s.autoRatio = autoInput.checked;
      applyAutoLock();
      if (s.autoRatio) applyOptimalRatio();
    });
    applyAutoLock();
    box.appendChild(auto);

    var wRangeInput = wSlider.querySelector('input[type="range"]');
    wRangeInput.addEventListener('input', function () { if (s.autoRatio) applyOptimalRatio(); });

    function applyOptimalRatio() {
      var t = snap(s.width * 0.34, tCfg.min, tCfg.max, tCfg.step || 0.5);
      s.thickness = t;
      var input = tSlider.querySelector('input[type="range"]');
      var out = tSlider.querySelector('.zs-slider-val');
      input.value = t;
      out.textContent = fmtNum(t) + ' ' + (tCfg.unit || 'mm');
      self.refreshDiagrams();
      self.recalc();
      self.pushScene();
    }

    box.appendChild(hx('p', 'zs-eyebrow', 'Veličina prstena'));
    var shank = (this.c.model && this.c.model.shank) || {};
    box.appendChild(sizeRow('Veličina (EU)', shank.size || { min: 44, max: 68, step: 0.5 }, s.size, function (v) { s.size = v; }));

    return box;
  };

  // Re-draws the cross-section diagram after a width/thickness/profile
  // change, without a full renderPanel() (keeps slider focus/scroll position
  // intact while dragging).
  Configurator.prototype.refreshDiagrams = function () {
    var s = this.cur(), g = this.c.groups || {};
    if (this._diagramHost) {
      this._diagramHost.innerHTML = bigCrossSectionSVG(profileShapeOf(g, s.profile), s.width, s.thickness, profileParamsOf(g, s.profile));
    }
  };

  /* ---------------------------------------------------------------- Materijal */

  var TWO_SUB = [
    { id: '1:1', label: '1:1' }, { id: '1:2', label: '1:2' }, { id: '2:1', label: '2:1' },
    { id: '3:1', label: '3:1' }, { id: '4:1', label: '4:1' },
    { id: 'wave', label: 'Talas 1:1' }, { id: 'diag', label: 'Dijagonalno 1:1' },
    { id: 'diagm', label: 'Dijagonalno (ogledalo) 1:1' }, { id: 'seg', label: 'Segment 1:1' },
    { id: 'axial', label: 'Osovinski 1:1' }
  ];
  var THREE_SUB = [
    { id: '1:1:1', label: '1:1:1' }, { id: '1:2:1', label: '1:2:1' }, { id: '2:1:1', label: '2:1:1' }
  ];

  function patternFillIcon(kind) {
    var w = 58, h = 34, d = crossSectionPath('court', w, h);
    var clipId = 'zsClip' + Math.random().toString(36).slice(2);
    var fills = '';
    if (kind === 'single') {
      fills = '<path d="' + d + '" class="zs-pat-fill"/>';
    } else if (kind === 'two') {
      fills = '<path d="' + d + '" class="zs-pat-fill zs-pat-fill-a"/>' +
        '<rect x="0" y="' + (-h / 2) + '" width="' + (w / 2) + '" height="' + h + '" class="zs-pat-fill zs-pat-fill-b" clip-path="url(#' + clipId + ')"/>';
    } else if (kind === 'three') {
      fills = '<path d="' + d + '" class="zs-pat-fill zs-pat-fill-a"/>' +
        '<rect x="' + (-w / 6) + '" y="' + (-h / 2) + '" width="' + (w / 3) + '" height="' + h + '" class="zs-pat-fill zs-pat-fill-b" clip-path="url(#' + clipId + ')"/>';
    } else {
      fills = '<path d="' + d + '" class="zs-pat-fill zs-pat-fill-free"/>' +
        '<line x1="' + (-w / 6) + '" y1="' + (-h / 2 - 4) + '" x2="' + (-w / 6) + '" y2="' + (h / 2 + 4) + '" class="zs-pat-dash"/>' +
        '<line x1="' + (w / 6) + '" y1="' + (-h / 2 - 4) + '" x2="' + (w / 6) + '" y2="' + (h / 2 + 4) + '" class="zs-pat-dash"/>';
    }
    return '<svg viewBox="0 0 96 64" class="zs-profile-icon">' +
      '<defs><clipPath id="' + clipId + '"><path d="' + d + '"/></clipPath></defs>' +
      '<g transform="translate(48,32)">' + fills + '<path d="' + d + '" class="zs-cs-shape"/></g></svg>';
  }

  Configurator.prototype.uiMaterijal = function (g, s) {
    var box = el('div', 'zs-materijal');
    var self = this;

    var patterns = el('div', 'zs-pattern-grid');
    var defs = [
      { id: 'single', label: 'Jedna boja' },
      { id: 'two', label: 'Dve boje', sub: TWO_SUB },
      { id: 'three', label: 'Tri boje', sub: THREE_SUB },
      { id: 'free', label: 'Slobodno', disabled: true }
    ];
    defs.forEach(function (def) {
      var wrap = el('div', 'zs-pattern-wrap');
      var card = el('button', 'zs-pattern-box' + (def.disabled ? ' is-disabled' : ''));
      card.type = 'button';
      card.setAttribute('aria-pressed', String(s.colorPattern === def.id));
      if (def.disabled) card.disabled = true;
      card.innerHTML = patternFillIcon(def.id) + '<span class="zs-profile-label">' + esc(def.label) + '</span>' +
        (def.disabled ? '<span class="zs-badge-soon">Uskoro</span>' : '');
      wrap.appendChild(card);
      if (def.sub && def.sub.length) {
        var pop = el('div', 'zs-pattern-popover');
        pop.hidden = true;
        var grid = el('div', 'zs-pattern-sub-grid');
        def.sub.forEach(function (sub) {
          var sb = el('button', 'zs-pattern-sub');
          sb.type = 'button';
          sb.textContent = sub.label;
          sb.setAttribute('aria-pressed', String(s.colorSubPattern === sub.id));
          sb.addEventListener('click', function () {
            s.colorPattern = def.id; s.colorSubPattern = sub.id;
            var zoneCount = def.id === 'three' ? 3 : 2;
            if (!s.materialZones || s.materialZones.length !== zoneCount) {
              s.materialZones = defaultZones(g.material, s.material, zoneCount);
            }
            pop.hidden = true;
            self.renderPanel(); self.pushScene();
          });
          grid.appendChild(sb);
        });
        pop.appendChild(hx('p', 'zs-eyebrow', def.label));
        pop.appendChild(grid);
        wrap.appendChild(pop);
        card.addEventListener('click', function (e) {
          e.stopPropagation();
          var wasHidden = pop.hidden;
          box.querySelectorAll('.zs-pattern-popover').forEach(function (n) { n.hidden = true; });
          pop.hidden = !wasHidden;
        });
      } else {
        card.addEventListener('click', function () {
          if (def.disabled) return;
          s.colorPattern = def.id; s.colorSubPattern = '';
          self.renderPanel(); self.pushScene();
        });
      }
      patterns.appendChild(wrap);
    });
    box.appendChild(patterns);

    var zoneCount = s.colorPattern === 'three' ? 3 : (s.colorPattern === 'two' ? 2 : 0);
    if (zoneCount && !RATIO_RE.test(s.colorSubPattern || '')) {
      // "Talas"/"Dijagonalno"/"Segment"/"Osovinski" etc. — chosen but not one
      // of the straight ratio splits the shader can actually do yet (needs a
      // per-angle coordinate, not just width) — still single-colour for now.
      box.appendChild(hx('p', 'zs-micro', 'Ovaj raspored (talas/dijagonalno/segment/osovinski) stiže uskoro — 3D za sada prikazuje samo pravolinijske razmere (1:1, 1:2...).'));
    }

    if (zoneCount) {
      if (!s.materialZones || s.materialZones.length !== zoneCount) s.materialZones = defaultZones(g.material, s.material, zoneCount);
      var zoneLabels = zoneCount === 3 ? ['Deo A', 'Deo B', 'Deo C'] : ['Deo A', 'Deo B'];
      var zonesRow = el('div', 'zs-dim-row');
      zoneLabels.forEach(function (label, i) {
        var zbox = el('div');
        zbox.appendChild(hx('p', 'zs-eyebrow', label));
        zbox.appendChild(self.uiSwatches(g.material, s.materialZones[i], function (v) { s.materialZones[i] = v; }));
        zonesRow.appendChild(zbox);
      });
      box.appendChild(zonesRow);
    } else {
      box.appendChild(hx('p', 'zs-eyebrow', 'Metal'));
      box.appendChild(this.uiSwatches(g.material, s.material, function (v) { s.material = v; }));
    }

    box.appendChild(hx('p', 'zs-eyebrow', 'Površina'));
    box.appendChild(this.uiChips(g.finish, s.finish, function (v) { s.finish = v; }));

    box.appendChild(hx('p', 'zs-eyebrow', 'Finoća'));
    var finRow = el('div', 'zs-chips');
    FINOCA.forEach(function (f) {
      var b = el('button', 'zs-chip');
      b.type = 'button';
      b.innerHTML = esc(f.label) + ' <span class="zs-chip-sub">' + esc(f.sub) + '</span>';
      b.setAttribute('aria-pressed', String((s.finoca || '585') === f.id));
      b.addEventListener('click', function () {
        s.finoca = f.id;
        self.renderPanel(); self.recalc(); self.pushScene();
      });
      finRow.appendChild(b);
    });
    box.appendChild(finRow);

    return box;
  };
  function defaultZones(materials, primarySlug, count) {
    var list = (materials || []).map(function (m) { return m.slug; });
    var out = [primarySlug];
    for (var i = 0; i < list.length && out.length < count; i++) {
      if (list[i] !== primarySlug) out.push(list[i]);
    }
    while (out.length < count) out.push(primarySlug); // not enough distinct materials — repeat rather than crash
    return out.slice(0, count);
  }

  /* ------------------------------------------------------------------ Žlebovi */

  var GROOVE_SHAPES = [
    { id: 'v90', label: 'V-žleb 90°' },
    { id: 'u-round', label: 'U-žleb (zaobljen)' },
    { id: 'angular', label: 'Ugaoni žleb' },
    { id: 'perlage', label: 'Perlaž' },
    { id: 'carbon', label: 'Karbon' }
  ];
  var GROOVE_TABS = ['Dizajn žlebova', 'Razdvajajući žlebovi', 'Slojevi'];

  function grooveShapeIcon(id) {
    var body;
    if (id === 'v90') body = '<path d="M20 44 L44 20 L68 44" class="zs-cs-shape-line"/>';
    else if (id === 'u-round') body = '<path d="M20 44 Q44 16 68 44" class="zs-cs-shape-line"/>';
    else if (id === 'angular') body = '<path d="M20 44 L34 24 L54 24 L68 44" class="zs-cs-shape-line"/>';
    else if (id === 'perlage') body = '<g class="zs-cs-shape-line" fill="currentColor" stroke="none">' +
      '<circle cx="34" cy="36" r="3"/><circle cx="44" cy="30" r="3"/><circle cx="54" cy="36" r="3"/></g>';
    else body = '<g class="zs-cs-shape-line"><line x1="40" y1="20" x2="40" y2="48"/><line x1="44" y1="20" x2="44" y2="48"/><line x1="48" y1="20" x2="48" y2="48"/></g>';
    return '<svg viewBox="0 0 88 56" class="zs-profile-icon">' +
      '<path d="M14 44 Q44 12 74 44" class="zs-cs-axis" fill="none"/>' + body + '</svg>';
  }

  Configurator.prototype.uiGrooves = function (s) {
    var box = el('div', 'zs-grooves');
    var self = this;

    var tabs = el('div', 'zs-groove-tabs');
    GROOVE_TABS.forEach(function (label, i) {
      var b = el('button', 'zs-groove-tab');
      b.type = 'button'; b.textContent = label;
      b.setAttribute('aria-pressed', String(s.grooveTab === i));
      b.addEventListener('click', function () { s.grooveTab = i; self.renderPanel(); self.gotoStep('Žlebovi'); });
      tabs.appendChild(b);
    });
    box.appendChild(tabs);

    if (s.grooveTab !== 0) {
      box.appendChild(hx('p', 'zs-micro', GROOVE_TABS[s.grooveTab] + ' stižu u jednoj od narednih verzija.'));
      return box;
    }

    box.appendChild(hx('p', 'zs-eyebrow', 'Oblik žleba'));
    var shapes = el('div', 'zs-profile-grid zs-groove-shapes');
    GROOVE_SHAPES.forEach(function (sh) {
      var b = el('button', 'zs-profile-box zs-groove-shape');
      b.type = 'button';
      b.setAttribute('aria-pressed', String((s._grooveShapeChoice || 'v90') === sh.id));
      b.innerHTML = grooveShapeIcon(sh.id) + '<span class="zs-profile-label">' + esc(sh.label) + '</span>';
      b.addEventListener('click', function () { s._grooveShapeChoice = sh.id; self.renderPanel(); self.gotoStep('Žlebovi'); });
      shapes.appendChild(b);
    });
    box.appendChild(shapes);

    var n = s.grooves.length;
    var addRow = el('div', 'zs-groove-addrow');
    addRow.appendChild(hx('span', 'zs-groove-count', n + ' žleb' + (n === 1 ? '' : (n === 0 ? 'ova' : 'a'))));
    var actions = el('div', 'zs-groove-actions');
    if (n) {
      var clr = el('button', 'zs-linkbtn');
      clr.type = 'button';
      clr.innerHTML = icon('trash') + ' Ukloni sve';
      clr.addEventListener('click', function () { s.grooves = []; self.renderPanel(); self.gotoStep('Žlebovi'); self.pushScene(); });
      actions.appendChild(clr);
    }
    var addBtn = el('button', 'zs-groove-add');
    addBtn.type = 'button';
    addBtn.innerHTML = icon('plusCircle') + ' Dodaj žleb';
    addBtn.addEventListener('click', function () {
      s.grooves.push({
        id: 'g' + Date.now() + Math.floor(Math.random() * 999),
        shape: s._grooveShapeChoice || 'v90', surface: 'polirano',
        width: 0.3, depth: 0.15, orientation: 'vertical', position: 0
      });
      self.renderPanel(); self.gotoStep('Žlebovi'); self.pushScene();
    });
    actions.appendChild(addBtn);
    addRow.appendChild(actions);
    box.appendChild(addRow);

    var list = el('div', 'zs-groove-list');
    var g = this.c.groups || {};
    s.grooves.forEach(function (grv, idx) {
      list.appendChild(self.grooveItem(grv, idx, s, g));
    });
    box.appendChild(list);

    return box;
  };

  var GROOVE_WIDTHS = [0.15, 0.20, 0.30, 0.40, 0.50, 0.60, 0.80];
  var GROOVE_DEPTHS = [0.05, 0.10, 0.15, 0.20, 0.25, 0.30, 0.40];

  // Per-groove settings card — Breuning-style labelled rows (client, 2026-09-09:
  // "žlebovi, ove opcije dole totalno loše, preslikaj način dizajna sa
  // njihovog sajta"): shape/surface/width/depth as dropdowns, orientation as
  // pills, position as a number + "mm", small live preview, delete link.
  Configurator.prototype.grooveItem = function (grv, idx, s, g) {
    var self = this;
    var row = el('div', 'zs-groove-item');

    var head = el('div', 'zs-groove-item-head');
    head.innerHTML = '<span class="zs-groove-badge">' + (idx + 1) + '</span><span>Podešavanja žleba</span>';
    var del = el('button', 'zs-linkbtn zs-groove-del');
    del.type = 'button';
    del.innerHTML = icon('trash') + ' Ukloni';
    del.addEventListener('click', function () {
      var i = s.grooves.indexOf(grv);
      if (i > -1) s.grooves.splice(i, 1);
      self.renderPanel(); self.gotoStep('Žlebovi'); self.pushScene();
    });
    head.appendChild(del);
    row.appendChild(head);

    var body = el('div', 'zs-groove-body');

    var preview = el('div', 'zs-groove-preview');
    var mat = bySlug(g.material, s.material);
    var color = (mat && mat.params && mat.params.pbr && mat.params.pbr.color) || '#D9A945';
    preview.style.background = 'linear-gradient(180deg,' + shade(color, 0.25) + ',' + color + ' 45%,' + shade(color, -0.2) + ')';
    var line = el('span', 'zs-groove-preview-line' + (grv.orientation === 'horizontal' ? ' is-h' : (grv.orientation === 'wave' ? ' is-wave' : '')));
    preview.appendChild(line);
    body.appendChild(preview);

    var rows = el('div', 'zs-groove-rows');

    function mmOpts(list, cur) {
      return list.map(function (v) { return { value: String(v), label: fmtNum(v) + ' mm' }; })
        .concat(list.indexOf(cur) === -1 ? [{ value: String(cur), label: fmtNum(cur) + ' mm' }] : []);
    }
    function syncPreviewLine() {
      var b = widthBounds(s.width, 1);
      var half = (grv.width || 0.3) / 2;
      var lo = b.min + half, hi = b.max - half;
      if (lo > hi) { lo = hi = 0; }
      grv.position = Math.round(Math.max(lo, Math.min(hi, grv.position || 0)) * 100) / 100;
      posInput.min = lo; posInput.max = hi; posInput.value = grv.position;
      posHint.textContent = 'raspon ' + fmtNum(lo) + '…' + fmtNum(hi) + ' mm';
      var posPct = 50 + Math.max(-1, Math.min(1, grv.position / Math.max(s.width / 2, 0.1))) * 40;
      // horizontal groove runs along the band → position moves it top↔bottom;
      // vertical / wave run across → position moves it left↔right.
      if (grv.orientation === 'horizontal') { line.style.top = posPct + '%'; line.style.left = ''; }
      else { line.style.left = posPct + '%'; line.style.top = ''; }
    }

    rows.appendChild(grooveRow('Oblik', selectEl(GROOVE_SHAPES.map(function (o) { return { value: o.id, label: o.label }; }), grv.shape, function (v) { grv.shape = v; bubble(rows); })));
    var surfaceOpts = (g.finish || []).map(function (o) { return { value: o.slug, label: o.label }; });
    rows.appendChild(grooveRow('Površina', selectEl(surfaceOpts.length ? surfaceOpts : [{ value: 'polirano', label: 'Polirano' }], grv.surface, function (v) { grv.surface = v; bubble(rows); })));
    rows.appendChild(grooveRow('Širina', selectEl(mmOpts(GROOVE_WIDTHS, grv.width), String(grv.width), function (v) { grv.width = parseFloat(v); syncPreviewLine(); bubble(rows); })));
    rows.appendChild(grooveRow('Dubina', selectEl(mmOpts(GROOVE_DEPTHS, grv.depth), String(grv.depth), function (v) { grv.depth = parseFloat(v); bubble(rows); })));

    var orient = el('div', 'zs-chips zs-groove-orient');
    [['horizontal', 'Horizontalno'], ['vertical', 'Vertikalno'], ['wave', 'Talas']].forEach(function (pair) {
      var b = el('button', 'zs-chip');
      b.type = 'button'; b.textContent = pair[1];
      b.setAttribute('aria-pressed', String(grv.orientation === pair[0]));
      b.addEventListener('click', function () {
        grv.orientation = pair[0];
        line.className = 'zs-groove-preview-line' + (pair[0] === 'horizontal' ? ' is-h' : (pair[0] === 'wave' ? ' is-wave' : ''));
        syncPreviewLine();
        bubble(b);
      });
      orient.appendChild(b);
    });
    rows.appendChild(grooveRow('Orijentacija', orient));

    var posWrap = el('div', 'zs-groove-posinput');
    var posInput = el('input');
    posInput.type = 'number'; posInput.step = '0.05';
    posInput.addEventListener('input', function () { grv.position = parseFloat(posInput.value) || 0; syncPreviewLine(); });
    posInput.addEventListener('change', function () { bubble(posInput); });
    var posUnit = el('span', 'zs-groove-posunit'); posUnit.textContent = 'mm';
    posWrap.appendChild(posInput); posWrap.appendChild(posUnit);
    var posField = grooveRow('Pozicija (od centra)', posWrap);
    var posHint = el('span', 'zs-groove-poshint');
    posField.appendChild(posHint);
    rows.appendChild(posField);

    syncPreviewLine();
    body.appendChild(rows);
    row.appendChild(body);
    return row;
  };
  function grooveRow(label, control) {
    var r = el('div', 'zs-groove-row');
    r.appendChild(hx('span', 'zs-groove-row-label', label));
    r.appendChild(control);
    return r;
  }

  /* ---------------------------------------------------------------- Dijamanti */

  var DIAMOND_GROUPS = [
    // Obrub/Kanal/Napeta postavka/Oko sklonjeni iz UI-ja (klijent, 2026-09-15:
    // "ostavi samo krunicu i veličinu kamena") — nisu ni menjali 3D geometriju
    // (vidi napomenu u #63), pa su samo zauzimali prostor bez ikakvog efekta.
    // Zakomentarisano, ne obrisano — vrati ih ako klijent kasnije zatraži te
    // tipove postavke (v2 backlog, docs/roadmap.md "Tehnički dug").
    // { title: 'Obrub', items: [{ id: 'bezel', label: 'Obrub (Bezel)' }] },
    // { title: 'Kanal', items: [
    //   { id: 'channel', label: 'Kanal' },
    //   { id: 'channel-cross', label: 'Kanal (poprečno)' },
    //   { id: 'channel-full', label: 'Kanal (cela burma)' },
    //   { id: 'channel-right', label: 'Kanal (desna strana)', disabled: true },
    //   { id: 'channel-left', label: 'Kanal (leva strana)', disabled: true },
    //   { id: 'channel-oblique', label: 'Kanal (koso)', disabled: true }
    // ] },
    // { title: 'Napeta postavka', items: [
    //   { id: 'tension-cross', label: 'Poprečno', disabled: true },
    //   { id: 'tension-oblique', label: 'Koso', disabled: true },
    //   { id: 'tension-convex', label: 'Konveksno-konkavno', disabled: true }
    // ] },
    // { title: 'Oko', items: [
    //   { id: 'eye-length', label: 'Uzdužno', disabled: true },
    //   { id: 'eye-cross', label: 'Poprečno', disabled: true },
    //   { id: 'eye-diag', label: 'Dijagonalno', disabled: true }
    // ] },
    // "Krunica" — 7 tipovi = 1:1 konkurentov "Chaton version" panel (Diamond
    // group → Bezel → Select setting type na konfigurator.breuning.de;
    // klijent, 2026-09-14, 2 screenshot-a po tipu). Var. 1 = široke skulptovane
    // "trellis" kandže bez kuglice na vrhu; Var. 2 = klasične žičane kandže sa
    // kuglicom (stari default). `carree-*` u sceneStateFor ide sa kvadratnim
    // kamenom (scene.module.js cut:'carree') — vidi CARREE_SETTINGS ispod;
    // "Brus" dropdown ostaje nezavisan, 3D oblik kamena se izvodi iz same
    // krunice. Konkurent ima "Carree Var. 2" zasivljen/nedostupan; kod nas
    // radi (geometrija postoji), ostavljeno uključeno.
    { title: 'Krunica', items: [
      { id: 'none', label: 'Bez dijamanta' },
      { id: 'prong4-v1', label: '4 kandže — var. 1' },
      { id: 'prong6-v1', label: '6 kandži — var. 1' },
      { id: 'carree-v1', label: 'Kare — var. 1' },
      { id: 'frame', label: 'Okvir' },
      { id: 'prong4-v2', label: '4 kandže — var. 2' },
      { id: 'prong6-v2', label: '6 kandži — var. 2' },
      { id: 'carree-v2', label: 'Kare — var. 2' }
    ] }
  ];
  var CARREE_SETTINGS = ['carree-v1', 'carree-v2'];
  var DIAMOND_CUTS = [
    { id: 'brilliant', label: 'Brilijant' },
    { id: 'princess', label: 'Princeza', disabled: true },
    { id: 'oval', label: 'Ovalni', disabled: true },
    { id: 'emerald', label: 'Smaragd', disabled: true }
  ];

  var DIAMOND_QUALITIES = [
    { value: 'standard', label: 'H / SI (standard)' },
    { value: 'top', label: 'G / VS (top)', disabled: true }
  ];

  // Reordered 2026-09-15 (client: "kao kod konkurencije" — Breuning/Fischer
  // both lead with "select setting type" and only reveal the stone picker
  // once a real type is chosen; Fischer's list literally opens on "Keine"
  // /none). Tip postavke (Krunica, ex-"none") now leads and is never gated;
  // Veličina kamena / Brus / Broj / Pozicioniranje stay hidden until the
  // customer picks a setting type other than "Bez dijamanta".
  Configurator.prototype.uiDiamonds = function (g, s) {
    var box = el('div', 'zs-diamonds');
    var self = this;

    box.appendChild(hx('p', 'zs-eyebrow', 'Tip postavke'));
    DIAMOND_GROUPS.forEach(function (grp) {
      var grpBox = el('div', 'zs-diamond-setting-group');
      grpBox.appendChild(hx('p', 'zs-eyebrow-sub', grp.title));
      var grid = el('div', 'zs-setting-grid');
      grp.items.forEach(function (it) {
        var b = el('button', 'zs-setting-box' + (it.disabled ? ' is-disabled' : ''));
        b.type = 'button';
        b.setAttribute('aria-pressed', String(s.diamondSetting === it.id));
        if (it.disabled) b.disabled = true;
        b.innerHTML = '<span class="zs-setting-label">' + esc(it.label) + '</span>' +
          (it.disabled ? '<span class="zs-badge-soon">Uskoro</span>' : '');
        b.addEventListener('click', function () {
          s.diamondSetting = it.id;
          // "Bez dijamanta" also clears any stone already chosen, so a stray
          // 'setting' string never reaches sceneStateFor without a real stone.
          if (it.id === 'none') s.diamond = 'bez';
          self.renderPanel(); self.recalc(); self.pushScene();
        });
        grid.appendChild(b);
      });
      grpBox.appendChild(grid);
      box.appendChild(grpBox);
    });

    var hasSetting = !!s.diamondSetting && s.diamondSetting !== 'none';
    if (!hasSetting) {
      box.appendChild(hx('p', 'zs-micro', 'Izaberite tip postavke da otključate izbor dijamanta.'));
      return box;
    }

    // Size chips are built inline (not via the shared uiChips) so a change can
    // trigger a full renderPanel() — the controls below are gated on hasStone.
    // "Bez dijamanta" isn't offered here any more — that choice now lives one
    // level up, as the "none" setting type.
    box.appendChild(hx('p', 'zs-eyebrow', 'Veličina kamena'));
    var sizes = el('div', 'zs-chips');
    (g.diamond || []).forEach(function (opt) {
      if (opt.slug === 'bez') return;
      var b = el('button', 'zs-chip');
      b.type = 'button';
      b.textContent = opt.label;
      b.setAttribute('aria-pressed', String(opt.slug === s.diamond));
      if (!opt.available) { b.disabled = true; b.title = 'Trenutno nedostupno'; }
      b.addEventListener('click', function () {
        s.diamond = opt.slug;
        self.renderPanel(); self.recalc(); self.pushScene();
      });
      sizes.appendChild(b);
    });
    box.appendChild(sizes);

    var sel = bySlug(g.diamond, s.diamond);
    var hasStone = !!(sel && sel.params && sel.params.mm > 0);
    if (!hasStone) {
      box.appendChild(hx('p', 'zs-micro', 'Izaberite veličinu kamena (u karatima) da otključate brus, broj i poziciju.'));
      return box;
    }

    var row1 = el('div', 'zs-dim-row');
    row1.appendChild(field('Brus', selectEl(DIAMOND_CUTS.map(function (c) { return { value: c.id, label: c.label, disabled: c.disabled }; }), s.diamondCut, function (v) { s.diamondCut = v; })));
    row1.appendChild(field('Kvalitet', selectEl(DIAMOND_QUALITIES, 'standard', function () {})));
    box.appendChild(row1);

    var qtyField = el('div', 'zs-field');
    qtyField.appendChild(hx('p', 'zs-eyebrow', 'Broj kamenova'));
    var qtyInput = el('input', 'zs-num');
    qtyInput.type = 'number'; qtyInput.min = '1'; qtyInput.max = '5'; qtyInput.value = s.diamondQty;
    qtyInput.addEventListener('input', function () {
      s.diamondQty = Math.max(1, Math.min(5, parseInt(qtyInput.value, 10) || 1));
      bubble(qtyInput);
    });
    qtyField.appendChild(qtyInput);
    box.appendChild(qtyField);

    // Position is across the band's WIDTH (client, 2026-09-07: a 5mm-wide
    // band can't take a stone at "10mm" — it must stay ≥1mm from each edge,
    // and can't sit inside a groove) — NOT a clock-position around the
    // circumference. Bounds are recomputed from the ring's live width/grooves
    // on every render, never a static -10..10.
    box.appendChild(hx('p', 'zs-eyebrow', 'Pozicioniranje'));
    var bounds = widthBounds(s.width, 1);
    var forbidden = grooveForbiddenRanges(s.grooves, 0.4);
    var posBox = el('div', 'zs-chips');
    [['levo', 'Levo', bounds.min], ['centar', 'Centar', 0], ['desno', 'Desno', bounds.max], ['slobodno', 'Slobodno', null]].forEach(function (pair) {
      var blocked = pair[2] !== null && Math.abs(nudgeOutOfForbidden(pair[2], bounds, forbidden) - pair[2]) > 0.05;
      var b = el('button', 'zs-chip');
      b.type = 'button';
      b.textContent = blocked ? pair[1] + ' — blokirano' : pair[1];
      b.setAttribute('aria-pressed', String(s.diamondPosMode === pair[0]));
      if (blocked) { b.disabled = true; b.title = 'Blokirano žlebom na toj poziciji'; }
      b.addEventListener('click', function () {
        s.diamondPosMode = pair[0];
        self.renderPanel();
      });
      posBox.appendChild(b);
    });
    box.appendChild(posBox);
    if (s.diamondPosMode === 'slobodno') {
      var step = 0.5;
      s.diamondPos = nudgeOutOfForbidden(Math.max(bounds.min, Math.min(bounds.max, s.diamondPos || 0)), bounds, forbidden);
      var srow = el('div', 'zs-slider');
      srow.style.marginTop = '12px';
      srow.innerHTML = '<div class="zs-slider-top"><span>Pozicija (od centra trake)</span><span class="zs-slider-val">' +
        fmtNum(s.diamondPos) + ' mm</span></div>';
      var input = el('input');
      input.type = 'range'; input.min = bounds.min; input.max = bounds.max; input.step = step; input.value = s.diamondPos;
      var out = srow.querySelector('.zs-slider-val');
      input.addEventListener('input', function () {
        s.diamondPos = nudgeOutOfForbidden(parseFloat(input.value), bounds, forbidden);
        input.value = s.diamondPos;
        out.textContent = fmtNum(s.diamondPos) + ' mm';
      });
      srow.appendChild(input);
      box.appendChild(srow);
      if (forbidden.length) box.appendChild(hx('p', 'zs-micro', 'Pozicija se automatski pomera van žleba ako se preklapaju.'));
    }

    return box;
  };

  /* -------------------------------------------------------------------- panel: shared */

  Configurator.prototype.section = function (label, num, body) {
    var sec = el('section', 'zs-acc');
    sec.dataset.section = label;
    var open = !!this.openSections[label];
    if (open) sec.classList.add('is-open');
    // Plain <div>, not <button> (client, 2026-09-14, screenshots). It used to
    // be a button that toggled .is-open on click — but since only the active
    // step's block exists at all (see .zs-acc in configurator.css), the only
    // header ever clickable was the one already open, so clicking it closed
    // the ONLY visible block and left the whole right panel blank with
    // nothing left in it to reopen (only "Sledeće" / the top-nav, via
    // gotoStep(), reach a section at all). Header is inert now — and isn't
    // a <button> any more so it doesn't pick up the global `.zs-configurator
    // button { cursor: pointer }` rule and look clickable when it isn't.
    // No chevron either (client, 2026-09-14): it's an expand/collapse
    // affordance and this header doesn't expand/collapse anything anymore —
    // just the number + title.
    var head = el('div', 'zs-acc-head');
    head.innerHTML = '<span class="zs-acc-title"><span class="zs-acc-n">' + num + '.</span> ' + esc(label.toUpperCase()) + '</span>';
    var self = this;
    var wrap = el('div', 'zs-acc-body');
    wrap.appendChild(body);

    // "Primeni na drugu burmu" — copies just this step's fields from the
    // active ring to the other one (client/Breuning: "Einstellung für Ring 1
    // übernehmen", offered per step).
    if (SECTION_FIELDS[label]) {
      var other = this.activeRing === 'her' ? 'Njegovu' : 'Njenu';
      var applyBtn = el('button', 'zs-acc-apply');
      applyBtn.type = 'button';
      applyBtn.innerHTML = icon('copy') + ' Primeni na ' + other + ' burmu';
      applyBtn.addEventListener('click', function () { self.copySection(label); bubble(applyBtn); });
      wrap.appendChild(applyBtn);
    }

    var idx = STEPS.indexOf(label);
    if (idx > -1 && idx + 1 < STEPS.length) {
      var next = el('button', 'zs-acc-next');
      next.type = 'button';
      next.innerHTML = 'Sledeće: ' + esc(STEPS[idx + 1]) + ' ' + icon('chevronRight');
      next.addEventListener('click', function () { self.goNext(label); });
      wrap.appendChild(next);
    }
    sec.appendChild(head);
    sec.appendChild(wrap);
    return sec;
  };

  Configurator.prototype.uiSwatches = function (list, value, set) {
    var box = el('div', 'zs-swatches');
    (list || []).forEach(function (opt) {
      var wrap = el('div', 'zs-swatch-wrap');
      var b = el('button', 'zs-swatch');
      b.type = 'button';
      var pbr = (opt.params && opt.params.pbr) || {};
      b.style.background = swatchGradient(pbr.color || '#ccc');
      b.setAttribute('aria-pressed', String(opt.slug === value));
      if (!opt.available) { b.disabled = true; }
      b.addEventListener('click', function () { set(opt.slug); bubble(b); });
      wrap.appendChild(b);
      wrap.appendChild(hx('span', 'zs-swatch-label', opt.label));
      box.appendChild(wrap);
    });
    return box;
  };

  Configurator.prototype.uiChips = function (list, value, set) {
    var box = el('div', 'zs-chips');
    (list || []).forEach(function (opt) {
      var b = el('button', 'zs-chip');
      b.type = 'button';
      b.textContent = opt.label;
      b.setAttribute('aria-pressed', String(opt.slug === value));
      if (!opt.available) { b.disabled = true; b.title = 'Trenutno nedostupno'; }
      b.addEventListener('click', function () { set(opt.slug); bubble(b); });
      box.appendChild(b);
    });
    return box;
  };

  Configurator.prototype.uiEngraving = function (e, s) {
    var box = el('div', 'zs-engrave');
    if (!e) { box.appendChild(hx('p', 'zs-micro', 'Nije podešeno.')); return box; }
    var input = el('input');
    input.type = 'text'; input.maxLength = e.maxLen || 20;
    input.placeholder = 'Tekst gravure (do ' + (e.maxLen || 20) + ' znakova)';
    input.value = s.engravingText;
    var self = this;
    input.addEventListener('input', function () {
      s.engravingText = input.value;
      // live-update the 3D engraving as you type (not just on blur)
      clearTimeout(self._engTimer);
      self._engTimer = setTimeout(function () { self.pushScene(); }, 120);
    });
    box.appendChild(input);
    var sides = el('div', 'zs-chips');
    (e.sides || ['inside', 'outside']).forEach(function (side) {
      var b = el('button', 'zs-chip');
      b.type = 'button';
      b.textContent = side === 'inside' ? 'Unutra' : 'Spolja';
      b.setAttribute('aria-pressed', String(side === s.engravingSide));
      b.addEventListener('click', function () { s.engravingSide = side; bubble(b); });
      sides.appendChild(b);
    });
    box.appendChild(sides);
    box.appendChild(hx('p', 'zs-micro', e.price && e.price.amount ? ('Doplata: ' + money(e.price.amount, this.c)) : 'Bez doplate'));
    return box;
  };

  /* --------------------------------------------------------------- bottom bar */

  Configurator.prototype.buildBottombar = function () {
    var bar = el('div', 'zs-bottombar');
    bar.innerHTML =
      '<div class="zs-price">' +
        '<span class="zs-price-label">Cena za par</span>' +
        '<span class="zs-price-value">—</span>' +
        '<span class="zs-price-sub">PDV uključen · <span class="zs-weight">—</span></span>' +
        '<span class="zs-price-perring">' +
          '<span data-ring="her">Njena —</span><span data-ring="his">Njegova —</span>' +
        '</span>' +
      '</div>' +
      '<div class="zs-trust">' +
        trust('Procena izrade', '3–4 nedelje') +
        trust('Besplatna dostava', 'Osigurano') +
        trust('Besplatne izmene', 'U roku od 30 dana') +
      '</div>' +
      '<div class="zs-cta-group">' +
        '<button type="button" class="zs-cta">Pošalji upit</button>' +
        '<button type="button" class="zs-cta is-secondary">Zakaži termin</button>' +
      '</div>';
    this._priceValue = bar.querySelector('.zs-price-value');
    this._weightEl = bar.querySelector('.zs-weight');
    this._priceHerEl = bar.querySelector('.zs-price-perring [data-ring="her"]');
    this._priceHisEl = bar.querySelector('.zs-price-perring [data-ring="his"]');
    return bar;
  };

  /* ------------------------------------------------------------------ refresh */

  Configurator.prototype.cur = function () { return this.state[this.activeRing]; };

  Configurator.prototype.refresh = function () {
    this.renderPanel();
    var self = this;
    if (this._ringToggle) {
      this._ringToggle.querySelectorAll('.zs-ring-btn').forEach(function (b) {
        b.setAttribute('aria-pressed', String(b.dataset.ring === self.activeRing));
      });
    }
    this.recalc();
    this.pushScene();
    // Keep "view solo" locked to whichever ring is now active.
    this.applyViewSolo();
  };

  Configurator.prototype.recalc = function () {
    var her = this._ringPrice('her'), his = this._ringPrice('his');
    var total = her.total + his.total;
    var priceable = her.priceable && his.priceable;
    var wPair = this.ringWeight('her') + this.ringWeight('his');
    if (this._weightEl) this._weightEl.textContent = wPair > 0 ? ('≈ ' + fmtNum(wPair) + ' g za par') : '';
    if (this._priceValue) this._priceValue.textContent = priceable ? money(Math.round(total), this.c) : 'Cena na upit';
    // Per-ring price line (client/Breuning: price shown per ring beside the pair total).
    if (this._priceHerEl) this._priceHerEl.textContent = 'Njena ' + (her.priceable ? money(Math.round(her.total), this.c) : 'na upit');
    if (this._priceHisEl) this._priceHisEl.textContent = 'Njegova ' + (his.priceable ? money(Math.round(his.total), this.c) : 'na upit');
  };

  Configurator.prototype._ringPrice = function (ringKey) {
    var c = this.c, g = c.groups || {}, s = this.state[ringKey];
    var mat = bySlug(g.material, s.material);
    var weight = this.ringWeight(ringKey);
    var total = 0; // all 4 catalogue "model" rows carry basePrice 0 (Seeder) — nothing lost by not tracking a model choice
    var priceable = true;

    if (mat && mat.price && mat.price.type === 'per_gram') {
      var perGram = (c.pricing && c.pricing.spotPrices && c.pricing.spotPrices[mat.price.spot_key]) || 0;
      if (perGram > 0) total += weight * perGram;
      else priceable = false;
    }
    total += flat(bySlug(g.finish, s.finish));
    total += flat(bySlug(g.diamond, s.diamond)) * Math.max(1, s.diamondQty || 1);
    if (s.engravingText && g.engraving && g.engraving.price) total += g.engraving.price.amount || 0;
    return { total: total, priceable: priceable };
  };

  // client's jeweller formula → grams for one ring
  Configurator.prototype.ringWeight = function (ringKey) {
    var c = this.c, g = c.groups || {}, s = this.state[ringKey];
    var mat = bySlug(g.material, s.material);
    var prof = bySlug(g.profile, s.profile);
    var baseDensity = (mat && mat.price && mat.price.density) || 0;
    if (!baseDensity) return 0;
    // Fineness picks the specific gravity (18k gold is denser → heavier ring).
    var fdef = finocaDef(s.finoca);
    var density = fdef.dens[s.material] || baseDensity;
    var fill = num(prof && prof.params && prof.params.fill, 1.0);
    var meanCirc = s.size + Math.PI * s.thickness;      // mm
    var area = s.width * s.thickness * fill;            // mm²
    var volume_cm3 = area * meanCirc / 1000;
    return volume_cm3 * density;                        // g
  };

  /* -------------------------------------------------------------- tiny helpers */

  function railBtn(k, glyph, title) { return '<button type="button" class="zs-rail-btn" data-k="' + k + '" title="' + title + '" aria-label="' + title + '">' + glyph + '</button>'; }
  function toolBtn(glyph, label) { return '<button type="button" class="zs-tool-btn"><span aria-hidden="true">' + glyph + '</span>' + esc(label) + '</button>'; }
  function mixHex(a, b, t) {
    function p(h) { h = String(h).replace('#', ''); return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]; }
    var x = p(a), y = p(b), o = '#';
    for (var i = 0; i < 3; i++) {
      var v = Math.round(x[i] + (y[i] - x[i]) * Math.max(0, Math.min(1, t)));
      o += ('0' + v.toString(16)).slice(-2);
    }
    return o;
  }
  function trust(a, b) { return '<div class="zs-trust-item"><strong>' + esc(a) + '</strong><span>' + esc(b) + '</span></div>'; }

  function field(label, control) {
    var row = el('div', 'zs-field');
    row.appendChild(hx('p', 'zs-eyebrow', label));
    row.appendChild(control);
    return row;
  }
  function selectEl(options, value, set) {
    var s = el('select', 'zs-select');
    (options || []).forEach(function (o) {
      var op = document.createElement('option');
      op.value = o.value; op.textContent = o.label;
      if (o.disabled) { op.disabled = true; op.textContent += ' (uskoro)'; }
      if (o.value === value) op.selected = true;
      s.appendChild(op);
    });
    s.addEventListener('change', function () { set(s.value); });
    return s;
  }
  function rangeEl(min, max, step, value, unit, set) {
    var wrap = el('div', 'zs-slider zs-slider-compact');
    wrap.innerHTML = '<div class="zs-slider-top"><span></span><span class="zs-slider-val">' + fmtNum(value) + ' ' + unit + '</span></div>';
    var input = el('input');
    input.type = 'range'; input.min = min; input.max = max; input.step = step; input.value = value;
    var out = wrap.querySelector('.zs-slider-val');
    input.addEventListener('input', function () { set(parseFloat(input.value)); out.textContent = fmtNum(input.value) + ' ' + unit; });
    wrap.appendChild(input);
    return wrap;
  }
  function slider(label, cfg, val, set) {
    var row = el('div', 'zs-slider');
    row.innerHTML = '<div class="zs-slider-top"><span>' + esc(label) + '</span><span class="zs-slider-val">' +
      fmtNum(val) + ' ' + (cfg.unit || 'mm') + '</span></div>';
    var input = el('input');
    input.type = 'range'; input.min = cfg.min; input.max = cfg.max; input.step = cfg.step || 0.5; input.value = val;
    var out = row.querySelector('.zs-slider-val');
    input.addEventListener('input', function () { set(parseFloat(input.value)); out.textContent = fmtNum(input.value) + ' ' + (cfg.unit || 'mm'); });
    row.appendChild(input);
    var ticks = el('div', 'zs-slider-ticks');
    niceTicks(cfg.min, cfg.max, cfg.step || 0.5).forEach(function (v) { ticks.appendChild(hx('span', '', fmtNum(v))); });
    row.appendChild(ticks);
    return row;
  }
  function sizeRow(label, cfg, val, set) {
    var row = el('div', 'zs-slider');
    row.innerHTML = '<div class="zs-slider-top"><span>' + esc(label) + '</span><span class="zs-slider-val">' + fmtNum(val) + '</span></div>';
    var input = el('input');
    input.type = 'range'; input.min = cfg.min; input.max = cfg.max; input.step = cfg.step || 0.5; input.value = val;
    var out = row.querySelector('.zs-slider-val');
    input.addEventListener('input', function () { set(parseFloat(input.value)); out.textContent = fmtNum(input.value); });
    row.appendChild(input);
    var ticks = el('div', 'zs-slider-ticks');
    niceTicks(cfg.min, cfg.max, cfg.step || 0.5).forEach(function (v) { ticks.appendChild(hx('span', '', fmtNum(v))); });
    row.appendChild(ticks);
    return row;
  }
  // Tick labels aligned to the slider's REAL step (client, 2026-09-06) — the
  // old equal-4-way-division math produced values like 4.3/5.5/6.8 on a
  // min3/max8/step0.5 slider, which don't correspond to any reachable value.
  function niceTicks(min, max, step) {
    step = step || 1;
    var span = max - min;
    var mult = Math.max(1, Math.round((span / 4) / step));
    var tickStep = mult * step;
    var out = [];
    for (var v = min; v <= max + 1e-9; v += tickStep) out.push(Math.round(v * 100) / 100);
    if (out[out.length - 1] < max - 1e-9) out.push(Math.round(max * 100) / 100);
    return out;
  }
  function snap(v, min, max, step) {
    step = step || 1;
    v = Math.max(min, Math.min(max, v));
    var n = Math.round((v - min) / step) * step + min;
    return Math.round(n * 100) / 100;
  }

  function firstSlug(list) { return (list && list[0] && list[0].slug) || ''; }
  function firstAvail(list) {
    if (!list || !list.length) return '';
    for (var i = 0; i < list.length; i++) if (list[i].available) return list[i].slug;
    return list[0].slug;
  }
  function bySlug(list, slug) {
    if (!list) return null;
    for (var i = 0; i < list.length; i++) if (list[i].slug === slug) return list[i];
    return null;
  }
  function flat(opt) { return (opt && opt.price && opt.price.type === 'flat') ? (opt.price.amount || 0) : 0; }
  function profileShapeOf(g, profileSlug) {
    var prof = bySlug(g.profile, profileSlug);
    return (prof && prof.params && prof.params.shape) || 'flat';
  }
  function profileParamsOf(g, profileSlug) {
    var prof = bySlug(g.profile, profileSlug);
    return (prof && prof.params) || null;
  }
  // "Količina" resolves to N flush stones spaced evenly AROUND the band's
  // circumference (v1 only ever places flush stones directly into the band,
  // no crown/prong geometry yet — decisions.md #22), all sharing the same
  // WIDTH-axis offset (see diamondWidthPos below — that's what "Pozicioniranje"
  // actually controls, corrected 2026-09-07: it was wrongly wired to
  // circumference before).
  function diamondPositions(s) {
    var n = Math.max(1, Math.min(5, s.diamondQty || 1));
    if (n === 1) return [0];
    var spacing = 2.4;
    var start = -spacing * (n - 1) / 2;
    var out = [];
    for (var i = 0; i < n; i++) out.push(start + spacing * i);
    return out;
  }
  // "Levo"/"Centar"/"Desno"/"Slobodno" — where across the band's WIDTH the
  // stone(s) sit (client, 2026-09-07: a 5mm band can't take a stone at
  // "10mm"; must stay ≥1mm from each edge and can't overlap a groove).
  // widthBounds/grooveForbiddenRanges/nudgeOutOfForbidden are also used
  // directly by uiDiamonds (see there) to size the slider + disable blocked
  // preset buttons; kept here too since sceneStateFor needs the same
  // resolved value for the actual 3D placement.
  function widthBounds(width, margin) {
    margin = margin == null ? 1 : margin;
    var half = Math.max(0, (width || 0) / 2 - margin);
    return { min: -half, max: half };
  }
  function grooveForbiddenRanges(grooves, clearance) {
    clearance = clearance == null ? 0.4 : clearance;
    return (grooves || []).map(function (grv) {
      var half = (grv.width || 0.3) / 2 + clearance;
      var p = grv.position || 0;
      return [p - half, p + half];
    });
  }
  function nudgeOutOfForbidden(value, bounds, forbidden) {
    value = Math.max(bounds.min, Math.min(bounds.max, value));
    for (var iter = 0; iter < forbidden.length + 1; iter++) {
      var hit = null;
      for (var i = 0; i < forbidden.length; i++) {
        if (value > forbidden[i][0] && value < forbidden[i][1]) { hit = forbidden[i]; break; }
      }
      if (!hit) break;
      value = (Math.abs(value - hit[0]) <= Math.abs(value - hit[1])) ? hit[0] : hit[1];
      value = Math.max(bounds.min, Math.min(bounds.max, value));
    }
    return Math.round(value * 100) / 100;
  }
  function diamondWidthPos(s) {
    var bounds = widthBounds(s.width, 1);
    var forbidden = grooveForbiddenRanges(s.grooves, 0.4);
    var base = s.diamondPosMode === 'levo' ? bounds.min
      : s.diamondPosMode === 'desno' ? bounds.max
      : s.diamondPosMode === 'slobodno' ? (s.diamondPos || 0) : 0;
    return nudgeOutOfForbidden(base, bounds, forbidden);
  }
  // Materijal step's "Dve boje"/"Tri boje" → real multi-colour band (client,
  // 2026-09-07: "boje se ne menjaju, uvek je jedan" — this used to be UI-only,
  // decisions.md #34). Only the straight ratio sub-patterns (1:1, 1:2, 2:1,
  // 3:1, 4:1, 1:1:1, 1:2:1, 2:1:1) are real 3D — wave/diagonal/segment/axial
  // need a per-ANGLE coordinate the shader doesn't have yet, so those still
  // fall back to a single colour (see uiMaterijal's note to the client).
  var RATIO_RE = /^\d+(:\d+){1,2}$/;
  function colorZonesFor(s, g) {
    if (s.colorPattern !== 'two' && s.colorPattern !== 'three') return null;
    var zoneCount = s.colorPattern === 'three' ? 3 : 2;
    var sub = s.colorSubPattern || '';
    if (!RATIO_RE.test(sub)) return null;
    var parts = sub.split(':').map(Number);
    if (parts.length !== zoneCount) return null;
    var zones = s.materialZones || [];
    var colors = [];
    for (var i = 0; i < zoneCount; i++) {
      var m = bySlug(g.material, zones[i] || s.material);
      colors.push((m && m.params && m.params.pbr && m.params.pbr.color) || '#D9A945');
    }
    var total = parts.reduce(function (a, b) { return a + b; }, 0);
    var half = (s.width || 4) / 2;
    var stops = [];
    var acc = 0;
    for (var j = 0; j < parts.length - 1; j++) { acc += parts[j]; stops.push(-half + (acc / total) * (s.width || 4)); }
    return { colors: colors, stops: stops };
  }
  // Refined metal-sample look (client 2026-09-09: the old glossy "plastic
  // marble" radial gradient looked cheap next to the competitor). A conic
  // sweep = spun/polished metal sheen, a soft off-centre highlight = form,
  // a faint dark vignette = edge. Reads as a jeweller's metal chip.
  function swatchGradient(hex) {
    hex = /^#[0-9a-fA-F]{6}$/.test(hex) ? hex : '#cccccc';
    var lite = shade(hex, 0.34), dark = shade(hex, -0.30), deep = shade(hex, -0.46);
    return [
      'radial-gradient(circle at 34% 30%, rgba(255,255,255,.75) 0%, rgba(255,255,255,0) 42%)',
      'radial-gradient(circle at 68% 78%, ' + deep + ' 0%, rgba(0,0,0,0) 46%)',
      'conic-gradient(from 128deg, ' + dark + ', ' + lite + ', ' + hex + ', ' + dark + ', ' + lite + ', ' + hex + ', ' + dark + ')'
    ].join(', ');
  }
  function shade(hex, amt) {
    var n = parseInt(hex.replace('#', ''), 16);
    var r = clamp((n >> 16) + amt * 255), gg = clamp(((n >> 8) & 255) + amt * 255), b = clamp((n & 255) + amt * 255);
    return '#' + ((1 << 24) + (r << 16) + (gg << 8) + b).toString(16).slice(1);
  }
  function clamp(v) { return Math.max(0, Math.min(255, Math.round(v))); }

  function num() { for (var i = 0; i < arguments.length; i++) { var v = Number(arguments[i]); if (!isNaN(v) && arguments[i] != null && arguments[i] !== '') return v; } return 0; }
  function el(tag, cls) { var n = document.createElement(tag); if (cls) n.className = cls; return n; }
  function hx(tag, cls, text) { var n = el(tag, cls); n.textContent = text; return n; }
  function esc(s) { var d = document.createElement('div'); d.textContent = s == null ? '' : s; return d.innerHTML; }
  function cssEsc(s) { return String(s).replace(/"/g, '\\"'); }
  function bubble(node) { node.dispatchEvent(new Event('change', { bubbles: true })); }
  function fmtNum(n) { return (Math.round(Number(n) * 10) / 10).toString().replace('.', ','); }
  function money(n, c) {
    var cur = (c && c.pricing && c.pricing.currency) || (c && c.currency) || 'RSD';
    return Math.round(Number(n) || 0).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.') + ' ' + cur;
  }

  document.addEventListener('click', function (e) {
    if (!e.target.closest('.zs-pattern-wrap')) {
      document.querySelectorAll('.zs-pattern-popover').forEach(function (n) { n.hidden = true; });
    }
  });

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
