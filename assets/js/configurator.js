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
 * Live weight/price (decisions #76/#77), per ring:
 *   volume_mm3  = enclosed volume of the ring's real band mesh (scene.ringVolume:
 *                 profile × width × thickness × size, grooves carved in)
 *   mass_g      = volume_mm3 / 1000 × density(metal, finoća)          — CMS
 *   ringPrice   = ceil(mass_g × pricePerGram(finoća) + finish + diamond + engraving)
 *                 pricePerGram = admin-entered RSD/g (CMS), used as is; no spot price
 *   pairPrice   = ringHer + ringHis   (sum of the two ceiled ring prices)
 * Authoritative price is recomputed server-side on inquiry (Faza 5).
 */
(function () {
  'use strict';

  var STEPS = ['Profil', 'Dimenzije', 'Materijal', 'Žlebovi', 'Dijamanti', 'Gravura'];
  var RINGS = [{ key: 'her', label: 'Njena burma' }, { key: 'his', label: 'Njegova burma' }];

  // Fineness (finoća/karat) — comes from the WordPress CMS (Podešavanja →
  // „Cena zlata po gramu“, zs_settings.finoce → payload pricing.finoce,
  // decisions #77): id/label, price_key into pricing.spotPrices (RSD/g, admin
  // entered, used AS IS), density g/cm³ per metal slug, `deepen` swatch tint.
  // Nothing about price or density is hardcoded here.
  function finoceOf(c) { return (c && c.pricing && c.pricing.finoce) || []; }
  function finocaDef(c, id) {
    var list = finoceOf(c);
    for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i];
    return list[0] || { id: '', label: '', sub: '', price_key: '', density: {}, deepen: 0 };
  }

  // Which state fields each accordion step owns — used by "Primeni na drugu
  // burmu" (client/Breuning: "Einstellung für Ring 1 übernehmen" per step).
  var SECTION_FIELDS = {
    'Profil':    ['profile'],
    'Dimenzije': ['width', 'thickness', 'size', 'autoRatio'],
    'Materijal': ['material', 'bandMetals', 'rhodium', 'division', 'finish', 'finoca'],
    'Žlebovi':   ['grooveTab', 'grooves', 'separation', 'edges'],
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

  // `mm` = { W, H } real width/thickness. Keyword profiles are drawn from the
  // exact loop the 3D band is built from (ZSCScene.profileLoop, decisions
  // #75) once the scene module is loaded; the hand-drawn paths below are only
  // the fallback before that.
  function crossSectionPath(shape, w, h, p, mm) {
    var r = Math.min(w, h) * 0.16;
    var wama = p && p.wama;
    if ((shape !== 'param' || wama) && window.ZSCScene && window.ZSCScene.profileLoop) {
      var W = (mm && mm.W) || 5, H = (mm && mm.H) || 1.5;
      var loop = window.ZSCScene.profileLoop(shape, W, H, null, wama);
      var sx = w / W, sy = h / H, path = '';
      for (var k = 0; k < loop.length; k++) {
        path += (k ? ' L ' : 'M ') + (loop[k][0] * sx).toFixed(2) + ' ' + ((H / 2 - loop[k][1]) * sy).toFixed(2);
      }
      return path + ' Z';
    }
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
    var d = crossSectionPath(shape, w, h, p, { W: widthMm, H: thicknessMm });
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
    // Faza 3 (decisions #76): opening sizes = Wama's — his 5 × 1,2 vel. 62,
    // her 5 × 1,0 vel. 54 (same profile/geometry rules for both rings).
    var def = ringKey === 'her' ? { w: 5, t: 1.0, size: 54 } : { w: 5, t: 1.2, size: 62 };
    var metal = firstAvail(g.material);
    return {
      material: metal,           // = bandMetals[0]
      // Faza 4 (decisions #78): colour bands across the width (Wama division
      // presets), one metal + rhodium flag per band, one fineness per ring.
      bandMetals: [metal],
      rhodium: [false],
      division: { id: 'none', pct: 30, cycles: 2, cuts: [] },
      separation: { active: true, form: 'v-groove-90', width: 0.2, depth: 0.1 },
      edges: { left: { form: 'none', width: 0.5, depth: 0.1 }, right: { form: 'none', width: 0.5, depth: 0.1 } },
      profile: firstSlug(g.profile),
      finish: firstAvail(g.finish),
      diamond: 'bez', // client 2026-09-15: ring starts with NO stone — matches
      // competitor default ("Keine"/no diamond group until the customer picks
      // a setting type); was firstAvail(g.diamond), which pre-selected the
      // first stock stone before the customer had chosen anything.
      width: snap(def.w, wCfg.min, wCfg.max, wCfg.step || 0.5),
      thickness: snap(def.t, tCfg.min, tCfg.max, tCfg.step || 0.1),
      size: snap(def.size, sCfg.min, sCfg.max, sCfg.step || 0.5),
      autoRatio: false,
      finoca: (finoceOf(c)[0] || {}).id || '',
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
      // Profile icons/diagram drawn before the scene module loaded used the
      // fallback paths — redraw them from the real profile geometry.
      if (this._panel) this.renderPanel();
      this.recalc(); // weight/price from the real band mesh (scene.ringVolume)
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
    var c = this.c, g = c.groups || {}, s = this.state[ringKey], self = this;
    var fin = bySlug(g.finish, s.finish);
    var dia = bySlug(g.diamond, s.diamond);
    var finPbr = (fin && fin.params && fin.params.pbr) || {};
    var wp = dia && dia.params && dia.params.mm ? diamondWidthPos(s, g) : null;
    var stone = wp !== null ? { mm: dia.params.mm, positions: diamondPositions(s), widthPos: wp } : null;
    // geometry (profile, grooves, edges, division, separation) + look
    return Object.assign(this.geoOf(s), {
      profileKey: s.profile,
      metal: s.bandMetals[0], // scene picks the metal's LUT (Faza 2 look)
      bandLuts: s.bandMetals.map(function (m) { return self.lutOf(m); }),
      roughness: typeof finPbr.roughness === 'number' ? finPbr.roughness : 0.08,
      stone: stone,
      engraving: (s.engravingText || '').trim()
        ? { text: (s.engravingText || '').trim(), side: s.engravingSide || 'inside' } : null
    });
  };

  // HeightAdaptation (Wama, FAZA3 §3.4): some profiles can't be built below
  // a thickness (bombé P13 ≥ 1,4, jastučasti P12 ≥ 1,2, deep domes on wide
  // bands…). Lift the ring's thickness to that minimum instead of building
  // an impossible section; the visible slider follows.
  Configurator.prototype.adaptHeights = function () {
    if (!window.ZSCScene || !window.ZSCScene.profileMinH) return;
    var g = this.c.groups || {}, self = this;
    var tCfg = g.thickness || { min: 0.8, max: 2.5, step: 0.1, unit: 'mm' };
    ['her', 'his'].forEach(function (k) {
      var s = self.state[k], pp = profileParamsOf(g, s.profile) || {};
      var minH = window.ZSCScene.profileMinH(pp.shape || 'flat', s.width, pp.wama);
      if (s.thickness < minH - 1e-9) {
        s.thickness = snap(minH, tCfg.min, tCfg.max, tCfg.step || 0.1);
        if (k === self.activeRing && self._tSlider) {
          self._tSlider.querySelector('input[type="range"]').value = s.thickness;
          self._tSlider.querySelector('.zs-slider-val').textContent = fmtNum(s.thickness) + ' ' + (tCfg.unit || 'mm');
          self.refreshDiagrams();
        }
      }
    });
  };

  Configurator.prototype.pushScene = function () {
    if (!this.scene) return;
    this.adaptHeights();
    this.normalizeRing(this.state.her);
    this.normalizeRing(this.state.his);
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
    this._tSlider = tSlider;
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

  /* ---------------------------------------------------------------- Materijal
   *
   * Faza 4 (decisions #78, docs/faza4/FAZA4-metali-i-zlebovi.md §1–§8, §25):
   *  - metal = colour (LUT) + one fineness per ring; density and price come
   *    from the CMS (fineness table + material row), never from here;
   *  - colour division = Wama's 24 presets: bands ACROSS the width, each
   *    360° round the ring, straight / wave / diagonal / free cuts;
   *  - every band has its own metal (+ rhodium for white gold);
   *  - rules: a metal that can't be combined (manganese) is single-colour only;
   *    a metal that only exists in some finenesses forces one of them.
   */

  var DIV_GROUPS = [
    { id: 'single', label: 'Jedna boja', presets: ['none'] },
    { id: 'two', label: 'Dve boje', presets: ['vertical-1-1', 'vertical-1-2', 'vertical-1-3', 'wave-1-1', 'diagonal-1-1'] },
    { id: 'three', label: 'Tri boje', presets: ['vertical-1-1-1', 'vertical-2-1-1', 'vertical-3-1-1', 'vertical-4-1-1', 'vertical-1-2-1',
      'vertical-1-3-1', 'vertical-1-4-1', 'vertical-2-1-2', 'wave-1-1-1', 'wave-1-2-1', 'wave-2-1-2', 'diagonal-1-1-1', 'diagonal-1-2-1', 'diagonal-2-1-2'] },
    { id: 'free', label: 'Slobodno', presets: ['vertical-free-2', 'vertical-free-3', 'vertical-free-4', 'vertical-free-5'] }
  ];
  function divKind(id) { return /^wave/.test(id) ? 'wave' : (/^diagonal/.test(id) ? 'diagonal' : (/free/.test(id) ? 'free' : (id === 'none' ? 'none' : 'vertical'))); }
  function divRates(id) {
    if (!id || id === 'none') return [1];
    var m = /free-(\d)/.exec(id);
    if (m) { var r = []; for (var i = 0; i < +m[1]; i++) r.push(1); return r; }
    return id.split('-').filter(function (t) { return /^\d+$/.test(t); }).map(Number);
  }
  function divLabel(id) {
    if (id === 'none') return 'Jedna boja';
    var k = divKind(id), r = divRates(id).join(':');
    if (k === 'free') return divRates(id).length + ' trake';
    return (k === 'wave' ? 'Talas ' : (k === 'diagonal' ? 'Dijagonala ' : '')) + r;
  }
  function divGroupOf(id) {
    for (var i = 0; i < DIV_GROUPS.length; i++) if (DIV_GROUPS[i].presets.indexOf(id) > -1) return DIV_GROUPS[i].id;
    return 'single';
  }
  // Straight cuts in mm from the left edge (free: the customer's own cuts).
  function presetCutsOf(div, W) {
    var rates = divRates(div.id);
    if (divKind(div.id) === 'free' && div.cuts && div.cuts.length === rates.length - 1) return div.cuts.slice();
    var sum = rates.reduce(function (a, b) { return a + b; }, 0), acc = 0, out = [];
    for (var i = 0; i < rates.length - 1; i++) { acc += W * rates[i] / sum; out.push(Math.round(acc * 1e4) / 1e4); }
    return out;
  }
  var ICON_FALLBACK = ['#E3C77A', '#D9D7D3', '#E2AE8E', '#C9C8CC', '#A9A6A4'];

  // Unrolled band (circumference → right, width ↓) — what the preset does to
  // the ring, drawn with the ring's current band colours (FAZA4 fig3).
  function divisionIconSVG(id, colors, pct, cycles) {
    var w = 72, h = 30, rates = divRates(id), kind = divKind(id), n = rates.length;
    var sum = rates.reduce(function (a, b) { return a + b; }, 0);
    var A = (kind === 'wave' || kind === 'diagonal') ? (pct || 30) / 100 * h / 2 : 0;
    var cyc = kind === 'diagonal' ? 1 : (kind === 'wave' ? (cycles || 2) : 0);
    var cuts = [], acc = 0;
    for (var i = 0; i < n - 1; i++) { acc += h * rates[i] / sum; cuts.push(acc); }
    function edge(c) {
      if (!A) return 'L ' + w + ' ' + c.toFixed(2);
      var d = '';
      for (var k = 1; k <= 36; k++) { var x = w * k / 36; d += ' L ' + x.toFixed(2) + ' ' + (c - A * Math.sin(cyc * 2 * Math.PI * k / 36)).toFixed(2); }
      return d;
    }
    function edgeBack(c) {
      if (!A) return 'L 0 ' + c.toFixed(2);
      var d = '';
      for (var k = 35; k >= 0; k--) { var x = w * k / 36; d += ' L ' + x.toFixed(2) + ' ' + (c - A * Math.sin(cyc * 2 * Math.PI * k / 36)).toFixed(2); }
      return d;
    }
    var body = '';
    for (var b = 0; b < n; b++) {
      var top = b === 0 ? null : cuts[b - 1], bot = b === n - 1 ? null : cuts[b];
      var d = top === null ? 'M 0 0 L ' + w + ' 0' : 'M 0 ' + top.toFixed(2) + ' ' + edge(top);
      d += bot === null ? ' L ' + w + ' ' + h + ' L 0 ' + h : (' L ' + w + ' ' + (bot - A * Math.sin(cyc * 2 * Math.PI)).toFixed(2) + edgeBack(bot));
      body += '<path d="' + d + ' Z" fill="' + (colors[b] || ICON_FALLBACK[b % 2]) + '"/>';
    }
    for (var c = 0; c < cuts.length; c++) body += '<path d="M 0 ' + cuts[c].toFixed(2) + ' ' + edge(cuts[c]) + '" class="zs-div-line"/>';
    return '<svg viewBox="-2 -2 ' + (w + 4) + ' ' + (h + 4) + '" class="zs-div-icon" aria-hidden="true">' + body +
      '<rect x="0" y="0" width="' + w + '" height="' + h + '" class="zs-div-frame"/></svg>';
  }

  Configurator.prototype.matOf = function (slug) { return bySlug((this.c.groups || {}).material, slug); };
  Configurator.prototype.lutOf = function (slug) { var m = this.matOf(slug); return (m && m.params && m.params.lut) || slug; };
  Configurator.prototype.densityOf = function (slug, finocaId) {
    var f = finocaDef(this.c, finocaId);
    return Number(f.density && f.density[slug]) || 0;
  };
  Configurator.prototype.combinable = function (slug) { var m = this.matOf(slug); return !(m && m.params && m.params.combinable === false); };
  Configurator.prototype.rhodiumOk = function (slug) { var m = this.matOf(slug); return !!(m && m.params && m.params.rhodium); };
  Configurator.prototype.swatchColor = function (slug) { var m = this.matOf(slug); return (m && m.params && m.params.pbr && m.params.pbr.color) || '#D9A945'; };

  // Finenesses in which every band metal exists (density > 0).
  Configurator.prototype.finocaOkFor = function (metals, finocaId) {
    var self = this;
    return metals.every(function (m) { return self.densityOf(m, finocaId) > 0; });
  };
  // Wama GreedyAlloyCombination, our way: when a metal isn't made in the
  // current fineness, the ring moves to the first fineness all bands exist in.
  Configurator.prototype.fixFinoca = function (s) {
    if (this.finocaOkFor(s.bandMetals, s.finoca)) return false;
    var list = finoceOf(this.c);
    for (var i = 0; i < list.length; i++) if (this.finocaOkFor(s.bandMetals, list[i].id)) { s.finoca = list[i].id; return true; }
    return false;
  };

  // Band metals when the division changes: keep what's there, fill the rest
  // alternating the first two combinable metals (Wama: yellow / white).
  Configurator.prototype.setDivision = function (s, id) {
    var g = this.c.groups || {}, self = this;
    var n = divRates(id).length;
    s.division.id = id;
    if (divKind(id) === 'free') s.division.cuts = presetCutsOf({ id: id }, s.width);
    var combinable = (g.material || []).filter(function (m) { return m.available && self.combinable(m.slug); }).map(function (m) { return m.slug; });
    var first = s.bandMetals[0];
    if (n > 1 && !this.combinable(first)) first = combinable[0] || first;
    var second = combinable.filter(function (m) { return m !== first; })[0] || first;
    var out = [];
    for (var i = 0; i < n; i++) out.push(i < s.bandMetals.length && (n === 1 || this.combinable(s.bandMetals[i])) ? s.bandMetals[i] : (i % 2 ? second : first));
    if (n > 1 && out.every(function (m) { return m === out[0]; })) for (var j = 1; j < n; j += 2) out[j] = second;
    s.bandMetals = out;
    s.rhodium = out.map(function (m, i) { return !!(s.rhodium && s.rhodium[i]) && self.rhodiumOk(m); });
    s.material = out[0];
    this.fixFinoca(s);
    this.normalizeRing(s);
  };

  Configurator.prototype.uiMaterijal = function (g, s) {
    var box = el('div', 'zs-materijal');
    var self = this;
    var colors = s.bandMetals.map(function (m) { return self.swatchColor(m); });
    var group = divGroupOf(s.division.id);

    box.appendChild(hx('p', 'zs-eyebrow', 'Raspored boja'));
    var patterns = el('div', 'zs-pattern-grid');
    DIV_GROUPS.forEach(function (grp) {
      var wrap = el('div', 'zs-pattern-wrap');
      var card = el('button', 'zs-pattern-box');
      card.type = 'button';
      card.setAttribute('aria-pressed', String(group === grp.id));
      var shown = group === grp.id ? s.division.id : grp.presets[0];
      card.innerHTML = divisionIconSVG(shown, colors, s.division.pct, s.division.cycles) +
        '<span class="zs-profile-label">' + esc(grp.label) + '</span>' +
        (group === grp.id && grp.presets.length > 1 ? '<span class="zs-pattern-cur">' + esc(divLabel(s.division.id)) + '</span>' : '');
      wrap.appendChild(card);
      if (grp.presets.length === 1) {
        card.addEventListener('click', function () { self.setDivision(s, grp.presets[0]); self.renderPanel(); self.recalc(); self.pushScene(); });
      } else {
        var pop = el('div', 'zs-pattern-popover');
        pop.hidden = true;
        pop.appendChild(hx('p', 'zs-eyebrow', grp.label));
        var grid = el('div', 'zs-pattern-sub-grid');
        grp.presets.forEach(function (id) {
          var sb = el('button', 'zs-pattern-sub');
          sb.type = 'button';
          sb.innerHTML = divisionIconSVG(id, colors, 30, 2) + '<span>' + esc(divLabel(id)) + '</span>';
          sb.setAttribute('aria-pressed', String(s.division.id === id));
          sb.addEventListener('click', function () {
            pop.hidden = true;
            self.setDivision(s, id);
            self.renderPanel(); self.recalc(); self.pushScene();
          });
          grid.appendChild(sb);
        });
        pop.appendChild(grid);
        wrap.appendChild(pop);
        card.addEventListener('click', function (e) {
          e.stopPropagation();
          var wasHidden = pop.hidden;
          box.querySelectorAll('.zs-pattern-popover').forEach(function (n) { n.hidden = true; });
          pop.hidden = !wasHidden;
        });
      }
      patterns.appendChild(wrap);
    });
    box.appendChild(patterns);

    var kind = divKind(s.division.id);
    var RG = geo();
    // Wave / diagonal: amplitude = % of half the width; wave also cycles.
    if (kind === 'wave' || kind === 'diagonal') {
      var ampRow = el('div', 'zs-chips zs-div-params');
      [30, 40, 50, 60, 70].forEach(function (p) {
        var b = el('button', 'zs-chip');
        b.type = 'button'; b.textContent = p + ' %';
        b.setAttribute('aria-pressed', String(s.division.pct === p));
        var ok = !RG || RG.wavePctAllowed(self.geoOf(s), p);
        if (!ok) { b.disabled = true; b.title = 'Talas bi izašao preko ivice prstena'; }
        b.addEventListener('click', function () { s.division.pct = p; self.renderPanel(); self.recalc(); self.pushScene(); });
        ampRow.appendChild(b);
      });
      box.appendChild(field('Visina talasa', ampRow));
      if (kind === 'wave') {
        var cycRow = el('div', 'zs-chips zs-div-params');
        [1, 2, 3, 4, 5, 6].forEach(function (n) {
          var b = el('button', 'zs-chip');
          b.type = 'button'; b.textContent = String(n);
          b.setAttribute('aria-pressed', String(s.division.cycles === n));
          b.addEventListener('click', function () { s.division.cycles = n; self.renderPanel(); self.recalc(); self.pushScene(); });
          cycRow.appendChild(b);
        });
        box.appendChild(field('Broj talasa', cycRow));
      }
    }
    // Free division: every cut movable in 0.01 mm steps (outer bands ≥ 0.6,
    // inner bands ≥ 0.5 — Wama slider limits).
    if (kind === 'free') {
      var cuts = s.division.cuts;
      cuts.forEach(function (cv, i) {
        var lo = i === 0 ? 0.6 : cuts[i - 1] + 0.5, hi = i === cuts.length - 1 ? s.width - 0.6 : cuts[i + 1] - 0.5;
        var row = el('div', 'zs-slider zs-slider-compact');
        row.innerHTML = '<div class="zs-slider-top"><span>Granica ' + (i + 1) + ' (od leve ivice)</span><span class="zs-slider-val">' + fmtMm2(cv) + ' mm</span></div>';
        var input = el('input');
        input.type = 'range'; input.min = lo; input.max = hi; input.step = 0.01; input.value = cv;
        var out = row.querySelector('.zs-slider-val');
        input.addEventListener('input', function () {
          cuts[i] = Math.round(Math.max(lo, Math.min(hi, parseFloat(input.value))) * 100) / 100;
          out.textContent = fmtMm2(cuts[i]) + ' mm';
          self.pushSceneSoon();
        });
        input.addEventListener('change', function () { self.renderPanel(); });
        row.appendChild(input);
        box.appendChild(row);
      });
    }

    // Metal per band (one band = the plain "Metal" picker).
    var n = s.bandMetals.length;
    s.bandMetals.forEach(function (slug, i) {
      var label = n === 1 ? 'Metal' : 'Traka ' + (i + 1) + (i === 0 ? ' (leva)' : (i === n - 1 ? ' (desna)' : ''));
      box.appendChild(hx('p', 'zs-eyebrow', label));
      box.appendChild(self.uiMetalSwatches(g.material, slug, n > 1, function (v) {
        s.bandMetals[i] = v;
        if (!self.rhodiumOk(v)) s.rhodium[i] = false;
        s.material = s.bandMetals[0];
        var moved = self.fixFinoca(s);
        self.renderPanel(); self.recalc(); self.pushScene();
        if (moved) self.flash('Finoća je promenjena na ' + finocaDef(self.c, s.finoca).label + ' — taj metal se radi samo u njoj.');
      }));
      if (self.rhodiumOk(slug)) {
        var rh = el('label', 'zs-check-row');
        rh.innerHTML = '<input type="checkbox"' + (s.rhodium[i] ? ' checked' : '') + '> Rodijumiranje' + (n > 1 ? ' (traka ' + (i + 1) + ')' : '');
        rh.querySelector('input').addEventListener('change', function (e) { s.rhodium[i] = e.target.checked; self.recalc(); });
        box.appendChild(rh);
      }
    });

    box.appendChild(hx('p', 'zs-eyebrow', 'Površina'));
    box.appendChild(this.uiChips(g.finish, s.finish, function (v) { s.finish = v; }));

    box.appendChild(hx('p', 'zs-eyebrow', 'Finoća'));
    var finRow = el('div', 'zs-chips');
    finoceOf(this.c).forEach(function (f) {
      var b = el('button', 'zs-chip');
      b.type = 'button';
      b.innerHTML = esc(f.label) + ' <span class="zs-chip-sub">' + esc(f.sub) + '</span>';
      b.setAttribute('aria-pressed', String(finocaDef(self.c, s.finoca).id === f.id));
      if (!self.finocaOkFor(s.bandMetals, f.id)) { b.disabled = true; b.title = 'Izabrani metal se ne radi u ovoj finoći'; }
      b.addEventListener('click', function () {
        s.finoca = f.id;
        self.renderPanel(); self.recalc(); self.pushScene();
      });
      finRow.appendChild(b);
    });
    box.appendChild(finRow);
    box.appendChild(this.flashHost());

    return box;
  };

  // Metal swatches; in a multi-colour ring a metal that can't be combined
  // (manganese, Wama §7) is disabled.
  Configurator.prototype.uiMetalSwatches = function (list, value, multi, set) {
    var self = this, box = el('div', 'zs-swatches');
    (list || []).forEach(function (opt) {
      var wrap = el('div', 'zs-swatch-wrap');
      var b = el('button', 'zs-swatch');
      b.type = 'button';
      b.style.background = swatchGradient(self.swatchColor(opt.slug));
      b.setAttribute('aria-pressed', String(opt.slug === value));
      var single = multi && !self.combinable(opt.slug);
      if (!opt.available || single) b.disabled = true;
      if (single) b.title = 'Samo za jednobojni prsten';
      b.addEventListener('click', function () { set(opt.slug); });
      wrap.appendChild(b);
      wrap.appendChild(hx('span', 'zs-swatch-label', opt.label));
      box.appendChild(wrap);
    });
    return box;
  };

  // Short status line under a step (groove moved / rejected, fineness forced).
  Configurator.prototype.flashHost = function () {
    var p = el('p', 'zs-micro zs-flash');
    p.setAttribute('role', 'status');
    if (this._flashMsg) p.textContent = this._flashMsg;
    this._flashEl = p;
    return p;
  };
  Configurator.prototype.flash = function (msg) {
    var self = this;
    this._flashMsg = msg;
    if (this._flashEl) this._flashEl.textContent = msg;
    clearTimeout(this._flashT);
    this._flashT = setTimeout(function () { self._flashMsg = ''; if (self._flashEl) self._flashEl.textContent = ''; }, 6000);
  };

  /* ------------------------------------------------------------------ Žlebovi
   *
   * Faza 4 (FAZA4 §9–§14, §19, §23): Wama's 7 design forms with their exact
   * width/depth lists, position = groove centre in mm from the LEFT edge
   * (0.01 steps), rims ≥ 0.5 mm from the ring edge and from each other — a
   * position in a forbidden spot is moved, a groove with no room is refused;
   * depth ≤ ½ of the wall under it. Separation grooves sit on every colour
   * boundary; edge steps on either side.
   */
  var GROOVE_TABS = ['Žlebovi', 'Granice boja', 'Ivice'];
  var GROOVE_FORM_ORDER = ['v-groove-60', 'v-groove-90', 'v-groove-120', 'u-groove', 'convex-u-groove', 'square-groove', 'perlage'];
  var GROOVE_LABEL = {
    'v-groove-60': 'V-žleb 60°', 'v-groove-90': 'V-žleb 90°', 'v-groove-120': 'V-žleb 120°', 'u-groove': 'U-žleb',
    'convex-u-groove': 'Ispupčeni', 'square-groove': 'Kvadratni', 'perlage': 'Perlaž'
  };

  // Icons drawn from the real 3D outline (§20: Wama's U icon exaggerates the
  // depth and its square icon has no chamfer — ours don't).
  function grooveShapeIcon(id) {
    var y = 22, body;
    if (id === 'v-groove-60') body = 'M8 ' + y + ' H36 L44 ' + (y + 14) + ' L52 ' + y + ' H80';
    else if (id === 'v-groove-90') body = 'M8 ' + y + ' H33 L44 ' + (y + 11) + ' L55 ' + y + ' H80';
    else if (id === 'v-groove-120') body = 'M8 ' + y + ' H30 L44 ' + (y + 8) + ' L58 ' + y + ' H80';
    else if (id === 'u-groove') body = 'M8 ' + y + ' H28 Q44 ' + (y + 16) + ' 60 ' + y + ' H80';
    else if (id === 'convex-u-groove') body = 'M8 ' + y + ' H26 V' + (y + 5) + ' Q44 ' + (y - 4) + ' 62 ' + (y + 5) + ' V' + y + ' H80';
    else if (id === 'square-groove') body = 'M8 ' + y + ' H31 L34 ' + (y + 3) + ' V' + (y + 13) + ' H54 V' + (y + 3) + ' L57 ' + y + ' H80';
    else body = 'M8 ' + y + ' H30 L32 ' + (y + 2) + ' V' + (y + 5) + ' H56 V' + (y + 2) + ' L58 ' + y + ' H80';
    var extra = id === 'perlage' ? '<ellipse cx="44" cy="' + (y + 1) + '" rx="9" ry="4.5" class="zs-cs-bead"/>' : '';
    return '<svg viewBox="0 0 88 46" class="zs-profile-icon" aria-hidden="true">' +
      '<path d="' + body + ' V44 H8 Z" class="zs-groove-metal"/>' + extra + '<path d="' + body + '" class="zs-cs-shape-line"/></svg>';
  }

  // Ring state → what ring-geometry.js needs (also part of the scene state).
  Configurator.prototype.geoOf = function (s, withStone) {
    var g = this.c.groups || {}, pp = profileParamsOf(g, s.profile) || {};
    var st = withStone ? this.stoneObstacle(s) : null;
    return {
      stone: st,
      width: s.width, thickness: s.thickness, size: s.size,
      profileShape: pp.shape || 'flat', profileWama: pp.wama || null,
      profileOutline: pp.shape === 'param' && !pp.wama ? paramProfileOutline(pp) : null,
      grooves: s.grooves.map(function (x) { return { form: x.form, pos: x.pos, width: x.width, depth: x.depth }; }),
      edges: { left: edgeOf(s.edges.left), right: edgeOf(s.edges.right) },
      division: { id: s.division.id, pct: s.division.pct, cycles: s.division.cycles, cuts: s.division.cuts },
      separation: { active: s.separation.active, form: s.separation.form, width: s.separation.width, depth: s.separation.depth }
    };
  };
  // the set stone as a groove obstacle, mm from the left edge (seat opening)
  Configurator.prototype.stoneObstacle = function (s) {
    var g = this.c.groups || {}, half = stoneHalf(s, g);
    if (!half) return null;
    var wp = diamondWidthPos(s, g);
    return wp === null ? null : { lo: wp + s.width / 2 - half, hi: wp + s.width / 2 + half };
  };
  function edgeOf(e) { return e && e.form !== 'none' ? { form: e.form, width: e.width, depth: e.depth } : { form: 'none' }; }
  function geo() { return window.ZSCScene && window.ZSCScene.geometry; }

  // Allowed width/depth options of a groove at its place (§12/§13).
  Configurator.prototype.grooveOptions = function (s, idx, form) {
    var RG = geo(), o = RG.GROOVE_FORMS[form], gs = this.geoOf(s, true), grv = s.grooves[idx];
    var pos = grv ? grv.pos : s.width / 2;
    function fits(w) { return RG.freeIntervals(gs, form, w, idx).length > 0; }
    function deep(w, d) { return RG.depthAllowed(gs, form, w, d, pos); }
    if (o.type === 'v') return { sizes: o.widths.filter(function (w) { return fits(w) && deep(w, RG.vDepth(o.angle, w)); }).map(function (w) { return [w, RG.vDepth(o.angle, w)]; }) };
    if (o.type === 'u') return { sizes: o.presets.filter(function (p) { return fits(p[0]) && deep(p[0], p[1]); }) };
    if (o.type === 'bump') return { sizes: o.widths.filter(fits).map(function (w) { return [w, 0.1]; }) };
    if (o.type === 'perlage') return { sizes: o.widths.filter(function (w) { return fits(w) && deep(w, 0.1); }).map(function (w) { return [w, 0.1]; }) };
    var w0 = grv ? grv.width : 0.5;
    return { widths: o.widths.filter(fits), depths: o.depths.filter(function (d) { return deep(w0, d); }) };
  };

  // Re-check every groove / edge / free cut / wave after anything that moves
  // the geometry (width, thickness, profile, division): positions are moved
  // into allowed spots, depths lowered to what the wall allows, and grooves
  // with no room left are removed (the customer is told).
  Configurator.prototype.normalizeRing = function (s) {
    var RG = geo();
    if (!RG) return;
    var W = s.width, d = s.division, msgs = [];
    if (divKind(d.id) === 'free') {
      var n = divRates(d.id).length - 1;
      if (!d.cuts || d.cuts.length !== n) d.cuts = presetCutsOf({ id: d.id }, W);
      for (var i = 0; i < n; i++) {
        var lo = i === 0 ? 0.6 : d.cuts[i - 1] + 0.5, hi = W - 0.6 - 0.5 * (n - 1 - i);
        d.cuts[i] = Math.round(Math.max(lo, Math.min(hi, d.cuts[i])) * 100) / 100;
      }
    }
    if (divKind(d.id) === 'wave' || divKind(d.id) === 'diagonal') {
      var gs0 = this.geoOf(s);
      while (d.pct > 30 && !RG.wavePctAllowed(gs0, d.pct)) { d.pct -= 10; gs0 = this.geoOf(s); }
    }
    var self = this;
    // edge steps: depth ≤ ½ wall, and gone if the outer band got too narrow
    ['left', 'right'].forEach(function (side) {
      var e = s.edges[side];
      if (e.form === 'none') return;
      var cuts = presetCutsOf(d, W), band = cuts.length ? (side === 'left' ? cuts[0] : W - cuts[cuts.length - 1]) : W / 2;
      if (e.width + (e.form === 'perlage' ? 0.05 : 0) > band - 0.1) { e.form = 'none'; msgs.push('Ivica je uklonjena — ne staje u krajnju traku.'); return; }
      if (e.form === 'normal') {
        var wall = RG.minWall(self.geoOf(s), side === 'left' ? 0 : W - e.width, side === 'left' ? e.width : W);
        while (e.depth > 0.05 && e.depth > 0.5 * wall + 1e-9) e.depth = Math.round((e.depth - 0.05) * 100) / 100;
      }
    });
    var keep = [];
    s.grooves.forEach(function (grv) {
      var trial = s.grooves.filter(function (x) { return keep.indexOf(x) > -1; });
      var st = self.geoOf(Object.assign({}, s, { grooves: trial.concat([grv]) }));
      var idx = trial.length;
      var p = RG.placeGroove(st, idx, grv.form, grv.width, grv.pos);
      if (p === null) { msgs.push(GROOVE_LABEL[grv.form] + ' je uklonjen — nema više mesta na prstenu.'); return; }
      grv.pos = p;
      // §13: depth ≤ ½ wall. Square: lower the depth; the others have their
      // depth tied to the size → the largest size that still fits, else gone.
      var o = RG.GROOVE_FORMS[grv.form];
      var gsx = self.geoOf(Object.assign({}, s, { grooves: trial.concat([grv]) }));
      if (o.type === 'rect') {
        while (grv.depth > 0.05 && !RG.depthAllowed(gsx, grv.form, grv.width, grv.depth, grv.pos)) grv.depth = Math.round((grv.depth - 0.05) * 100) / 100;
      } else if (!RG.depthAllowed(gsx, grv.form, grv.width, grv.depth, grv.pos)) {
        var sizes = o.type === 'v' ? o.widths.map(function (w) { return [w, RG.vDepth(o.angle, w)]; }) : (o.type === 'u' ? o.presets : []);
        var fit = sizes.filter(function (z) { return z[1] < grv.depth && RG.depthAllowed(gsx, grv.form, z[0], z[1], grv.pos); });
        if (!fit.length) { msgs.push(GROOVE_LABEL[grv.form] + ' je uklonjen — prsten je pretanak za njega.'); return; }
        fit.sort(function (a, b) { return b[1] - a[1]; });
        grv.width = fit[0][0]; grv.depth = fit[0][1];
        msgs.push(GROOVE_LABEL[grv.form] + ' je smanjen da ne bi probio tanji prsten.');
      }
      keep.push(grv);
    });
    s.grooves = keep.sort(function (a, b) { return a.pos - b.pos; });   // Wama keeps them sorted by position
    var sm = this.normalizeStone(s);
    if (sm) msgs.push(sm);
    if (msgs.length) this.flash(msgs.join(' '));
  };

  Configurator.prototype.uiGrooves = function (s) {
    var box = el('div', 'zs-grooves');
    var self = this;
    var RG = geo();

    // Live section of this ring with its grooves (exact, from ring-geometry).
    var diag = el('div', 'zs-cs-diagram-host zs-groove-section');
    diag.innerHTML = this.grooveSectionSVG(s);
    this._grooveDiagram = diag;
    box.appendChild(diag);

    var tabs = el('div', 'zs-groove-tabs');
    GROOVE_TABS.forEach(function (label, i) {
      var b = el('button', 'zs-groove-tab');
      b.type = 'button'; b.textContent = label;
      b.setAttribute('aria-pressed', String(s.grooveTab === i));
      b.addEventListener('click', function () { s.grooveTab = i; self.renderPanel(); self.gotoStep('Žlebovi'); });
      tabs.appendChild(b);
    });
    box.appendChild(tabs);
    if (!RG) { box.appendChild(hx('p', 'zs-micro', 'Učitavanje 3D prikaza…')); return box; }

    if (s.grooveTab === 1) box.appendChild(this.uiSeparation(s));
    else if (s.grooveTab === 2) box.appendChild(this.uiEdges(s));
    else box.appendChild(this.uiDesignGrooves(s));
    box.appendChild(this.flashHost());
    return box;
  };

  Configurator.prototype.uiDesignGrooves = function (s) {
    var box = el('div', 'zs-groove-design');
    var self = this, RG = geo();
    var choice = s._grooveForm || 'v-groove-90';

    box.appendChild(hx('p', 'zs-eyebrow', 'Oblik žleba'));
    var shapes = el('div', 'zs-profile-grid zs-groove-shapes');
    GROOVE_FORM_ORDER.forEach(function (id) {
      var b = el('button', 'zs-profile-box zs-groove-shape');
      b.type = 'button';
      b.setAttribute('aria-pressed', String(choice === id));
      b.innerHTML = grooveShapeIcon(id) + '<span class="zs-profile-label">' + esc(GROOVE_LABEL[id]) + '</span>';
      b.addEventListener('click', function () { s._grooveForm = id; self.renderPanel(); self.gotoStep('Žlebovi'); });
      shapes.appendChild(b);
    });
    box.appendChild(shapes);

    var n = s.grooves.length;
    var addRow = el('div', 'zs-groove-addrow');
    addRow.appendChild(hx('span', 'zs-groove-count', n + ' žleb' + (n === 1 ? '' : (n >= 2 && n <= 4 ? 'a' : 'ova'))));
    var actions = el('div', 'zs-groove-actions');
    if (n) {
      var clr = el('button', 'zs-linkbtn');
      clr.type = 'button';
      clr.innerHTML = icon('trash') + ' Ukloni sve';
      clr.addEventListener('click', function () { s.grooves = []; self.renderPanel(); self.gotoStep('Žlebovi'); self.recalc(); self.pushScene(); });
      actions.appendChild(clr);
    }
    var addBtn = el('button', 'zs-groove-add');
    addBtn.type = 'button';
    addBtn.innerHTML = icon('plusCircle') + ' Dodaj žleb';
    addBtn.addEventListener('click', function () {
      var d = RG.grooveDefaults(choice);
      var gs = self.geoOf(s, true);
      var opts = self.grooveOptions(s, -1, choice);
      // smallest size that fits if the default doesn't
      if (opts.sizes && opts.sizes.length && !opts.sizes.some(function (z) { return z[0] === d.width && Math.abs(z[1] - d.depth) < 1e-6; })) { d.width = opts.sizes[0][0]; d.depth = opts.sizes[0][1]; }
      var pos = RG.autoGroovePos(gs, choice, d.width);
      if (pos === null) { self.flash('Nema mesta za još jedan žleb (najmanje 0,5 mm od ivice i drugog žleba' + (gs.stone ? ', 0,2 mm od kamena' : '') + ').'); return; }
      s.grooves.push({ id: 'g' + Date.now() + Math.floor(Math.random() * 999), form: choice, pos: pos, width: d.width, depth: d.depth });
      s.grooves.sort(function (a, b) { return a.pos - b.pos; });
      self.renderPanel(); self.gotoStep('Žlebovi'); self.recalc(); self.pushScene();
    });
    actions.appendChild(addBtn);
    addRow.appendChild(actions);
    box.appendChild(addRow);

    var list = el('div', 'zs-groove-list');
    s.grooves.forEach(function (grv, idx) { list.appendChild(self.grooveItem(grv, idx, s)); });
    box.appendChild(list);
    return box;
  };

  // Per-groove card: form, size (width × depth as Wama links them), position.
  Configurator.prototype.grooveItem = function (grv, idx, s) {
    var self = this, RG = geo();
    var row = el('div', 'zs-groove-item');
    var head = el('div', 'zs-groove-item-head');
    head.innerHTML = '<span class="zs-groove-badge">' + (idx + 1) + '</span><span>' + esc(GROOVE_LABEL[grv.form]) + '</span>';
    var del = el('button', 'zs-linkbtn zs-groove-del');
    del.type = 'button';
    del.innerHTML = icon('trash') + ' Ukloni';
    del.addEventListener('click', function () {
      s.grooves.splice(s.grooves.indexOf(grv), 1);
      self.renderPanel(); self.gotoStep('Žlebovi'); self.recalc(); self.pushScene();
    });
    head.appendChild(del);
    row.appendChild(head);

    var body = el('div', 'zs-groove-body');
    var rows = el('div', 'zs-groove-rows');
    function commit() { s.grooves.sort(function (a, b) { return a.pos - b.pos; }); self.renderPanel(); self.gotoStep('Žlebovi'); self.recalc(); self.pushScene(); }
    function tryChange(apply) {
      var before = JSON.stringify(grv);
      apply();
      var p = RG.placeGroove(self.geoOf(s, true), idx, grv.form, grv.width, grv.pos);
      if (p === null) { Object.assign(grv, JSON.parse(before)); self.flash('Promena odbijena — žleb se ne bi uklopio (min. 0,5 mm do ivice i drugog žleba, 0,2 mm do kamena).'); commit(); return; }
      if (Math.abs(p - grv.pos) > 0.004) self.flash('Žleb je pomeren na ' + fmtMm2(p) + ' mm da ne bi dodirivao ivicu, drugi žleb ili kamen.');
      grv.pos = p;
      commit();
    }

    rows.appendChild(grooveRow('Oblik', selectEl(GROOVE_FORM_ORDER.map(function (f) { return { value: f, label: GROOVE_LABEL[f] }; }), grv.form, function (v) {
      tryChange(function () {
        grv.form = v;
        var d = RG.grooveDefaults(v), o = self.grooveOptions(s, idx, v);
        if (o.sizes && o.sizes.length && !o.sizes.some(function (z) { return z[0] === d.width; })) { d.width = o.sizes[0][0]; d.depth = o.sizes[0][1]; }
        grv.width = d.width; grv.depth = d.depth;
      });
    })));

    var opts = this.grooveOptions(s, idx, grv.form);
    if (opts.sizes) {
      var cur = grv.width + 'x' + grv.depth;
      var sizeOpts = opts.sizes.map(function (z) {
        var t = RG.GROOVE_FORMS[grv.form].type;
        var lbl = t === 'u' ? fmtMm2(z[0]) + ' × ' + fmtMm2(z[1]) + ' mm' : fmtMm2(z[0]) + ' mm' + (t === 'v' ? ' (dubina ' + fmtMm2(z[1]) + ')' : '');
        return { value: z[0] + 'x' + z[1], label: lbl };
      });
      if (!sizeOpts.some(function (o) { return o.value === cur; })) sizeOpts.unshift({ value: cur, label: fmtMm2(grv.width) + ' mm' });
      rows.appendChild(grooveRow(RG.GROOVE_FORMS[grv.form].type === 'u' ? 'Širina × dubina' : 'Širina', selectEl(sizeOpts, cur, function (v) {
        var p = v.split('x').map(Number);
        tryChange(function () { grv.width = p[0]; grv.depth = p[1]; });
      })));
      var t = RG.GROOVE_FORMS[grv.form].type;
      if (t === 'bump' || t === 'perlage') rows.appendChild(grooveRow('Dubina', hx('span', 'zs-groove-fixed', fmtMm2(grv.depth) + ' mm' + (t === 'perlage' ? ' · kuglice Ø ' + fmtMm2(grv.width * 7 / 9) + ' mm' : ''))));
    } else {
      rows.appendChild(grooveRow('Širina', selectEl(opts.widths.map(function (w) { return { value: String(w), label: fmtMm2(w) + ' mm' }; }), String(grv.width), function (v) {
        tryChange(function () { grv.width = parseFloat(v); });
      })));
      var dOpts = opts.depths.map(function (d) { return { value: String(d), label: fmtMm2(d) + ' mm' }; });
      if (!opts.depths.length) dOpts = [{ value: String(grv.depth), label: fmtMm2(grv.depth) + ' mm' }];
      rows.appendChild(grooveRow('Dubina', selectEl(dOpts, String(grv.depth), function (v) { grv.depth = parseFloat(v); commit(); })));
    }

    // Position: centre in mm from the left edge, 0.01 steps. Spots that break
    // the 0.5 mm rule snap to the nearest allowed one (Wama MoveGroove).
    var iv = RG.freeIntervals(this.geoOf(s, true), grv.form, grv.width, idx);
    var lo = iv.length ? iv[0][0] : grv.pos, hi = iv.length ? iv[iv.length - 1][1] : grv.pos;
    var posWrap = el('div', 'zs-groove-pos');
    var range = el('input');
    range.type = 'range'; range.min = lo; range.max = hi; range.step = 0.01; range.value = grv.pos;
    var num = el('input', 'zs-groove-posnum');
    num.type = 'number'; num.min = lo; num.max = hi; num.step = 0.01; num.value = grv.pos.toFixed(2);
    var unit = el('span', 'zs-groove-posunit'); unit.textContent = 'mm';
    function place(v, final) {
      var p = RG.placeGroove(self.geoOf(s, true), idx, grv.form, grv.width, v);
      if (p === null) return;
      grv.pos = p;
      range.value = p; num.value = p.toFixed(2);
      self.refreshGrooveDiagram();
      if (final) commit(); else self.pushSceneSoon();
    }
    range.addEventListener('input', function () { place(parseFloat(range.value), false); });
    range.addEventListener('change', function () { place(parseFloat(range.value), true); });
    num.addEventListener('change', function () {
      var v = parseFloat(String(num.value).replace(',', '.'));
      if (isNaN(v)) { num.value = grv.pos.toFixed(2); return; }
      var p = RG.placeGroove(self.geoOf(s, true), idx, grv.form, grv.width, v);
      if (p !== null && Math.abs(p - v) > 0.004) self.flash('Žleb je pomeren na ' + fmtMm2(p) + ' mm da ne bi dodirivao ivicu, drugi žleb ili kamen.');
      place(v, true);
    });
    posWrap.appendChild(range);
    var numWrap = el('span', 'zs-groove-posinput');
    numWrap.appendChild(num); numWrap.appendChild(unit);
    posWrap.appendChild(numWrap);
    var posField = grooveRow('Pozicija (od leve ivice)', posWrap);
    posField.appendChild(hx('span', 'zs-groove-poshint', 'raspon ' + fmtMm2(lo) + ' – ' + fmtMm2(hi) + ' mm'));
    rows.appendChild(posField);

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

  // Separation groove on every colour boundary (§8): V90 0.2 × 0.1 default;
  // forms V60/V90/V120/U/square, width 0.2–0.5, depth 0.1–0.25.
  Configurator.prototype.uiSeparation = function (s) {
    var box = el('div', 'zs-groove-sep'), self = this, RG = geo();
    if (divRates(s.division.id).length < 2) {
      box.appendChild(hx('p', 'zs-micro', 'Razdvajajući žleb stoji na granici dve boje. Izaberite „Dve boje“, „Tri boje“ ili „Slobodno“ u koraku Materijal.'));
      return box;
    }
    var sep = s.separation;
    var on = el('label', 'zs-check-row');
    on.innerHTML = '<input type="checkbox"' + (sep.active ? ' checked' : '') + '> Žleb na granicama boja';
    on.querySelector('input').addEventListener('change', function (e) { sep.active = e.target.checked; self.normalizeRing(s); self.renderPanel(); self.gotoStep('Žlebovi'); self.recalc(); self.pushScene(); });
    box.appendChild(on);
    if (!sep.active) return box;
    var rows = el('div', 'zs-groove-rows');
    function commit() { self.normalizeRing(s); self.renderPanel(); self.gotoStep('Žlebovi'); self.recalc(); self.pushScene(); }
    rows.appendChild(grooveRow('Oblik', selectEl(RG.SEPARATION_FORMS.map(function (f) { return { value: f, label: GROOVE_LABEL[f] }; }), sep.form, function (v) { sep.form = v; commit(); })));
    var isV = RG.GROOVE_FORMS[sep.form].type === 'v';
    rows.appendChild(grooveRow('Širina', selectEl(RG.SEPARATION_WIDTHS.map(function (w) {
      return { value: String(w), label: fmtMm2(w) + ' mm' + (isV ? ' (dubina ' + fmtMm2(RG.vDepth(RG.GROOVE_FORMS[sep.form].angle, w)) + ')' : '') };
    }), String(sep.width), function (v) { sep.width = parseFloat(v); commit(); })));
    if (!isV) rows.appendChild(grooveRow('Dubina', selectEl(RG.SEPARATION_DEPTHS.map(function (d) { return { value: String(d), label: fmtMm2(d) + ' mm' }; }), String(sep.depth), function (v) { sep.depth = parseFloat(v); commit(); })));
    box.appendChild(rows);
    return box;
  };

  // Edge step left / right (§9 "Krawędź"): none / step (width × depth) /
  // perlage. Widths that would not leave 0.5 mm to the nearest groove — or
  // not fit the outer colour band — are not offered.
  Configurator.prototype.uiEdges = function (s) {
    var box = el('div', 'zs-groove-edges'), self = this, RG = geo();
    var cuts = presetCutsOf(s.division, s.width);
    [['left', 'Leva ivica'], ['right', 'Desna ivica']].forEach(function (pair) {
      var side = pair[0], e = s.edges[side];
      box.appendChild(hx('p', 'zs-eyebrow', pair[1]));
      var chips = el('div', 'zs-chips');
      ['none', 'normal', 'perlage'].forEach(function (f) {
        var b = el('button', 'zs-chip');
        b.type = 'button'; b.textContent = RG.EDGE_FORMS[f].label;
        b.setAttribute('aria-pressed', String(e.form === f));
        b.addEventListener('click', function () {
          var old = JSON.stringify(e);
          e.form = f;
          if (f !== 'none') {
            var ws = edgeWidths(side, f);
            if (ws.indexOf(e.width) < 0) e.width = ws[0];
            if (f === 'normal' && !(e.depth > 0)) e.depth = 0.1;
            if (!ws.length) { Object.assign(e, JSON.parse(old)); self.flash('Ivica ne staje uz postojeće žlebove.'); }
          }
          self.renderPanel(); self.gotoStep('Žlebovi'); self.recalc(); self.pushScene();
        });
        chips.appendChild(b);
      });
      box.appendChild(chips);
      if (e.form === 'none') return;
      var rows = el('div', 'zs-groove-rows');
      var ws = edgeWidths(side, e.form);
      if (ws.indexOf(e.width) < 0) ws = ws.concat([e.width]).sort(function (a, b) { return a - b; });
      rows.appendChild(grooveRow('Širina', selectEl(ws.map(function (w) {
        var lbl = fmtMm2(w) + ' mm';
        if (e.form === 'perlage') lbl += ' · kuglice Ø ' + fmtMm2(RG.EDGE_FORMS.perlage.beads[RG.EDGE_FORMS.perlage.widths.indexOf(w)]);
        return { value: String(w), label: lbl };
      }), String(e.width), function (v) { e.width = parseFloat(v); self.renderPanel(); self.gotoStep('Žlebovi'); self.recalc(); self.pushScene(); })));
      if (e.form === 'normal') {
        var wall = RG.minWall(self.geoOf(s), side === 'left' ? 0 : s.width - e.width, side === 'left' ? e.width : s.width);
        var ds = RG.EDGE_FORMS.normal.depths.filter(function (d) { return d <= 0.5 * wall + 1e-9; });
        if (ds.indexOf(e.depth) < 0) e.depth = ds.length ? ds[ds.length - 1] : 0.05;
        rows.appendChild(grooveRow('Dubina', selectEl(ds.map(function (d) { return { value: String(d), label: fmtMm2(d) + ' mm' }; }), String(e.depth), function (v) { e.depth = parseFloat(v); self.recalc(); self.pushScene(); self.refreshGrooveDiagram(); })));
      } else rows.appendChild(grooveRow('Dubina', hx('span', 'zs-groove-fixed', '0,1 mm')));
      box.appendChild(rows);
    });
    function edgeWidths(side, form) {
      var list = RG.EDGE_FORMS[form].widths;
      var band = cuts.length ? (side === 'left' ? cuts[0] : s.width - cuts[cuts.length - 1]) : s.width / 2;
      var sepH = cuts.length && s.separation.active ? RG.grooveRimHalf(s.separation.form, s.separation.width) : 0;
      return list.filter(function (w) {
        var reach = w + (form === 'perlage' ? 0.05 : 0);
        if (reach > band - sepH - (cuts.length ? 0.1 : 0.5)) return false;
        return s.grooves.every(function (grv) {
          var h = RG.grooveRimHalf(grv.form, grv.width);
          return side === 'left' ? grv.pos - h >= reach + RG.GROOVE_GAP - 1e-9 : grv.pos + h <= s.width - reach - RG.GROOVE_GAP + 1e-9;
        });
      });
    }
    return box;
  };

  // The ring's grooved section, to scale, with the colour boundaries.
  Configurator.prototype.grooveSectionSVG = function (s) {
    var Z = window.ZSCScene;
    if (!Z || !Z.sectionLoop) return '';
    var sec = Z.sectionLoop(this.geoOf(s));
    var W = s.width, H = s.thickness, vw = 320, vh = 150, pad = 16;
    var k = Math.min((vw - 2 * pad) / W, (vh - 2 * pad - 14) / H);
    var ox = vw / 2, oy = vh - pad - 14;
    var d = sec.loop.map(function (p, i) { return (i ? 'L' : 'M') + (ox + p[0] * k).toFixed(2) + ' ' + (oy - p[1] * k).toFixed(2); }).join(' ') + ' Z';
    var self = this, colors = s.bandMetals.map(function (m) { return self.swatchColor(m); });
    var clip = 'zsSecClip' + (this.activeRing || '');
    var fills = '';
    var edges = [-W / 2].concat(sec.cuts.map(function (c) { return c - W / 2; })).concat([W / 2]);
    for (var i = 0; i < edges.length - 1; i++) {
      fills += '<rect x="' + (ox + edges[i] * k).toFixed(2) + '" y="0" width="' + ((edges[i + 1] - edges[i]) * k).toFixed(2) + '" height="' + vh + '" fill="' + colors[Math.min(i, colors.length - 1)] + '" clip-path="url(#' + clip + ')" opacity=".55"/>';
    }
    var beads = (sec.beads || []).map(function (b) {
      return '<ellipse cx="' + (ox + b.x * k).toFixed(2) + '" cy="' + (oy - b.centreZ * k).toFixed(2) + '" rx="' + (b.a * k).toFixed(2) + '" ry="' + (b.b * k).toFixed(2) + '" class="zs-cs-bead"/>';
    }).join('');
    var marks = s.grooves.map(function (grv, i) {
      return '<text x="' + (ox + (grv.pos - W / 2) * k).toFixed(2) + '" y="' + (pad - 2) + '" text-anchor="middle" class="zs-cs-label">' + (i + 1) + '</text>';
    }).join('');
    return '<svg viewBox="0 0 ' + vw + ' ' + vh + '" class="zs-cs-diagram" role="img" aria-label="Presek prstena sa žlebovima">' +
      '<defs><clipPath id="' + clip + '"><path d="' + d + '"/></clipPath></defs>' + fills +
      '<path d="' + d + '" class="zs-cs-shape zs-cs-shape-big" fill="none" style="fill:none"/>' + beads + marks +
      '<text x="' + ox + '" y="' + (vh - 2) + '" text-anchor="middle" class="zs-cs-label">' + fmtNum(W) + ' × ' + fmtNum(H) + ' mm · pozicije od leve ivice</text></svg>';
  };
  Configurator.prototype.refreshGrooveDiagram = function () {
    if (this._grooveDiagram && this._grooveDiagram.isConnected) this._grooveDiagram.innerHTML = this.grooveSectionSVG(this.cur());
  };
  // Live drag: push the scene at most once per animation frame.
  Configurator.prototype.pushSceneSoon = function () {
    var self = this;
    if (this._pushRaf) return;
    this._pushRaf = requestAnimationFrame(function () { self._pushRaf = 0; self.pushScene(); self.recalc(); });
  };

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
    // "Krunica" — bio je 7 tipova = 1:1 konkurentov "Chaton version" panel
    // (Round 10). Klijent, Round 14 (2026-09-15): "skidamo one kandže,
    // ostavljamo samo ovako nešto ništa više od toga kao na wamagold-u" —
    // pokazao wamagold-configurator.com "Diamonds" korak sa "Rubbed"
    // (flush-set, bez ijedne kandže) izabranim. Dole na jedan realan izbor:
    // ima kamen (`flush`, utisnut — scene.module.js FLUSH_SETTING, tanak
    // obod umesto kandži) ili nema (`none`). Prong/carree/frame geometrija
    // je uklonjena iz scene.module.js (v2 backlog ako se ikad zatraži).
    { title: 'Krunica', items: [
      { id: 'none', label: 'Bez dijamanta' },
      { id: 'flush', label: 'Utisnut' }
    ] }
  ];
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
    // Position across the band's WIDTH. A spot where the stone's seat would
    // touch a groove / edge step / colour-boundary groove is not offered,
    // and the customer sees why (client 2026-10-01).
    box.appendChild(hx('p', 'zs-eyebrow', 'Pozicioniranje'));
    var sm = this.normalizeStone(s);
    if (sm) this.flash(sm);
    var L = stoneLayout(s, g);
    var posBox = el('div', 'zs-chips');
    var reasons = [];
    [['levo', 'Levo'], ['centar', 'Centar'], ['desno', 'Desno'], ['slobodno', 'Slobodno']].forEach(function (pair) {
      var bl = pair[0] === 'slobodno' ? (L.free.length ? null : ['', '', 'nema slobodnog mesta']) : L.blocked[pair[0]];
      var b = el('button', 'zs-chip');
      b.type = 'button';
      b.textContent = pair[1];
      b.setAttribute('aria-pressed', String(s.diamondPosMode === pair[0]));
      if (bl) {
        b.disabled = true; b.title = 'Ovde kamen ne može — ' + bl[2];
        if (pair[0] !== 'slobodno') reasons.push(pair[1] + ': ' + bl[2]);
      }
      b.addEventListener('click', function () {
        s.diamondPosMode = pair[0];
        if (pair[0] === 'slobodno') s.diamondPos = nearestFree(s.diamondPos || 0, L.free);
        self.renderPanel(); self.recalc(); self.pushScene();
      });
      posBox.appendChild(b);
    });
    box.appendChild(posBox);
    if (reasons.length) {
      var note = el('div', 'zs-stone-note');
      note.setAttribute('role', 'note');
      note.innerHTML = '<strong>Kamen ne može da preseče žleb.</strong> Ležište kamena (Ø ' + fmtNum(L.half * 2) + ' mm) mora imati bar ' +
        fmtNum(STONE_GAP) + ' mm metala do žleba i ivice, pa nije dostupno:<br>' + reasons.map(esc).join('<br>');
      box.appendChild(note);
    }
    if (s.diamondPosMode === 'slobodno' && L.free.length) {
      var srow = el('div', 'zs-slider');
      srow.style.marginTop = '12px';
      srow.innerHTML = '<div class="zs-slider-top"><span>Pozicija (od centra trake)</span><span class="zs-slider-val">' +
        fmtMm2(s.diamondPos) + ' mm</span></div>';
      var input = el('input');
      input.type = 'range'; input.min = L.free[0][0]; input.max = L.free[L.free.length - 1][1]; input.step = 0.05; input.value = s.diamondPos;
      var out = srow.querySelector('.zs-slider-val');
      input.addEventListener('input', function () {
        s.diamondPos = nearestFree(parseFloat(input.value), L.free);
        input.value = s.diamondPos;
        out.textContent = fmtMm2(s.diamondPos) + ' mm';
        self.pushSceneSoon();
      });
      srow.appendChild(input);
      box.appendChild(srow);
      if (L.forbidden.length) {
        box.appendChild(hx('p', 'zs-micro', 'Dozvoljeno: ' + L.free.map(function (x) { return fmtMm2(x[0]) + ' do ' + fmtMm2(x[1]) + ' mm'; }).join(', ') +
          ' — klizač preskače mesta gde bi kamen dodirnuo žleb.'));
      }
    }
    box.appendChild(this.flashHost());

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
        '<span class="zs-price-label">Ukupno</span>' +
        '<span class="zs-price-value">—</span>' +
        '<span class="zs-price-sub">PDV uključen · <span class="zs-weight">—</span></span>' +
        '<span class="zs-price-perring">' +
          '<span data-ring="her">Cena prvog prstena: —</span><span data-ring="his">Cena drugog prstena: —</span>' +
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

  // Price (decisions #77): each ring on its own —
  //   exact band volume (3D mesh) → exact mass → raw price → Math.ceil
  // and the pair total is the SUM of the two ceiled ring prices (two separate
  // pieces), never ceil(rawA + rawB). Whole RSD, no decimals.
  Configurator.prototype.recalc = function () {
    this.adaptHeights();
    var her = this._ringPrice('her'), his = this._ringPrice('his');
    var total = her.total + his.total;                  // both already integers (ceiled)
    var priceable = her.priceable && his.priceable;
    var wPair = her.mass + his.mass;                    // display only — never fed back into price
    if (this._weightEl) this._weightEl.textContent = wPair > 0 ? ('≈ ' + fmtMass(wPair) + ' g za par') : '';
    if (this._priceValue) this._priceValue.textContent = priceable ? money(total, this.c) : 'Cena na upit';
    // Per-ring price line (client/Breuning: price shown per ring beside the pair total).
    // „prvi“ = RINGS[0] (Njena burma), „drugi“ = RINGS[1] (Njegova burma)
    if (this._priceHerEl) this._priceHerEl.textContent = 'Cena prvog prstena: ' + (her.priceable ? money(her.total, this.c) : 'na upit');
    if (this._priceHisEl) this._priceHisEl.textContent = 'Cena drugog prstena: ' + (his.priceable ? money(his.total, this.c) : 'na upit');
    this._lastPrice = { her: her, his: his, total: total, priceable: priceable }; // QA handle
  };

  // One ring (Faza 4, decisions #78; FAZA4 §25 "Cena"):
  //   per colour band  mass_k = V_k / 1000 × ρ(metal_k, finoća)          — CMS
  //   raw = Σ mass_k × (cena/g(finoća) + doplata klase/g(finoća) + metal_k doplata/g)
  //       + Σ metal flat surcharges (each metal once) + rodijum (once)
  //       + obrada + kamen + gravura
  //   ringPrice = ceil(raw)
  // V_k = exact metal of band k (grooves removed, perlage beads added). Class
  // = simple | special (V60/U/square/perlage groove or an edge) | multi (≥ 2
  // bands) | wavy (wave/diagonal), the highest one only (Wama §22).
  Configurator.prototype._ringPrice = function (ringKey) {
    var c = this.c, g = c.groups || {}, s = this.state[ringKey], self = this;
    var RG = geo();
    var fdef = finocaDef(c, s.finoca);
    var vols = this.bandVolumes(ringKey);
    var cls = RG ? RG.priceClass(this.geoOf(s)) : 'simple';
    var perGram = Number(c.pricing && c.pricing.spotPrices && c.pricing.spotPrices[fdef.price_key]) || 0;
    var clsExtra = Number(fdef.class_extra && fdef.class_extra[cls]) || 0;
    var priceable = perGram > 0;
    var raw = 0, mass = 0, flats = {}, rhodium = false, bands = [];
    vols.forEach(function (v, i) {
      var metal = s.bandMetals[Math.min(i, s.bandMetals.length - 1)];
      var dens = self.densityOf(metal, fdef.id);
      if (!dens) priceable = false;
      var m = (v / 1000) * dens;
      var pj = (self.matOf(metal) || {}).price || {};
      mass += m;
      raw += m * (perGram + clsExtra + num(pj.surcharge_per_gram));
      flats[metal] = num(pj.surcharge_flat);
      if (s.rhodium[i] && self.rhodiumOk(metal)) rhodium = true;
      bands.push({ metal: metal, volume: v, mass: m });
    });
    Object.keys(flats).forEach(function (k) { raw += flats[k]; });
    if (rhodium) raw += num(c.pricing && c.pricing.rhodium);
    raw += flat(bySlug(g.finish, s.finish));
    raw += flat(bySlug(g.diamond, s.diamond)) * Math.max(1, s.diamondQty || 1);
    if (s.engravingText && g.engraving && g.engraving.price) raw += g.engraving.price.amount || 0;
    if (!(mass > 0)) priceable = false;
    return { total: Math.ceil(raw), raw: raw, mass: mass, perGram: perGram, cls: cls, classExtra: clsExtra, finoca: fdef.id, bands: bands, priceable: priceable };
  };

  // Exact metal volume per colour band (mm³) — ring-geometry.js (the same
  // section the 3D band is swept from). Before the scene module has loaded:
  // the old fill-factor estimate as one band (recalc runs again on scene ready).
  Configurator.prototype.bandVolumes = function (ringKey) {
    var s = this.state[ringKey], RG = geo();
    if (RG) {
      var gs = this.geoOf(s), k = JSON.stringify(gs);
      this._volCache = this._volCache || {};
      if (!this._volCache[k]) {
        if (Object.keys(this._volCache).length > 60) this._volCache = {};
        this._volCache[k] = RG.bandVolumes(gs);
      }
      return this._volCache[k];
    }
    var pp = profileParamsOf(this.c.groups || {}, s.profile) || {};
    var est = s.width * s.thickness * num(pp.fill, 1.0) * (s.size + Math.PI * s.thickness);
    var n = s.bandMetals.length, out = [];
    for (var i = 0; i < n; i++) out.push(est / n);
    return out;
  };
  Configurator.prototype.ringVolume = function (ringKey) {
    return this.bandVolumes(ringKey).reduce(function (a, b) { return a + b; }, 0);
  };
  // grams for one ring (exact; rounding is display-only)
  Configurator.prototype.ringWeight = function (ringKey) { return this._ringPrice(ringKey).mass; };

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
  function widthBounds(width, margin) {
    margin = margin == null ? 1 : margin;
    var half = Math.max(0, (width || 0) / 2 - margin);
    return { min: -half, max: half };
  }
  // Stone ↔ groove (client 2026-10-01: "dijamant mora da izbegava žleb —
  // fizički je neizvodljivo"). The stone's seat opening (holeTop 1.03 × its
  // radius, scene.module.js stoneParams) must keep STONE_GAP (0.2 mm) of metal
  // to every groove rim, edge step and straight separation groove. Whichever
  // comes first wins: a stone can only go where the grooves leave room, and a
  // new / moved groove avoids a stone that is already set (geoOf(s, true)).
  var STONE_GAP = 0.2, SEAT_K = 1.03;
  function stoneHalf(s, g) {
    var dia = bySlug((g || {}).diamond, s.diamond);
    var mm = dia && dia.params && dia.params.mm;
    return s.diamondSetting && s.diamondSetting !== 'none' && mm > 0 ? (mm / 2) * SEAT_K : 0;
  }
  // Band-centred [lo, hi, what] spans the stone CENTRE must stay out of.
  function stoneForbidden(s, half) {
    var RG = geo(), c = s.width / 2, out = [], r = half + STONE_GAP;
    (s.grooves || []).forEach(function (grv) {
      var h = (RG ? RG.grooveRimHalf(grv.form, grv.width) : grv.width / 2) + r;
      out.push([grv.pos - c - h, grv.pos - c + h, GROOVE_LABEL[grv.form] + ' na ' + fmtMm2(grv.pos) + ' mm']);
    });
    if (divRates(s.division.id).length > 1 && s.separation.active) {
      var wavy = /^(wave|diagonal)/.test(s.division.id);
      var A = wavy ? (s.division.pct || 30) / 100 * c : 0;   // a wavy boundary sweeps ±A round the ring
      var sh = RG ? RG.grooveRimHalf(s.separation.form, s.separation.width) : 0.1;
      presetCutsOf(s.division, s.width).forEach(function (cv) { out.push([cv - c - A - sh - r, cv - c + A + sh + r, 'razdvajajući žleb na granici boja']); });
    }
    ['left', 'right'].forEach(function (side) {
      var e = s.edges[side];
      if (e.form === 'none') return;
      var w = e.width + (e.form === 'perlage' ? 0.05 : 0) + r;
      out.push(side === 'left' ? [-c - 1, -c + w, 'leva ivica'] : [c - w, c + 1, 'desna ivica']);
    });
    return out;
  }
  // stone centre limits across the width: seat ≥ 0.5 mm inside each edge
  function stoneBounds(s, half) {
    var m = Math.max(1, half + 0.5), h = Math.max(0, s.width / 2 - m);
    return { min: Math.round(-h * 100) / 100, max: Math.round(h * 100) / 100 };
  }
  function blockerAt(v, forbidden) {
    for (var i = 0; i < forbidden.length; i++) if (v > forbidden[i][0] + 1e-9 && v < forbidden[i][1] - 1e-9) return forbidden[i];
    return null;
  }
  // allowed centre intervals = bounds minus forbidden spans
  function stoneFree(bounds, forbidden) {
    var iv = [[bounds.min, bounds.max]];
    forbidden.forEach(function (f) {
      var next = [];
      iv.forEach(function (x) {
        if (f[1] <= x[0] || f[0] >= x[1]) { next.push(x); return; }
        if (f[0] > x[0]) next.push([x[0], f[0]]);
        if (f[1] < x[1]) next.push([f[1], x[1]]);
      });
      iv = next;
    });
    return iv.filter(function (x) { return x[1] - x[0] >= -1e-9; })
      .map(function (x) { return [Math.ceil(x[0] * 100 - 1e-6) / 100, Math.floor(x[1] * 100 + 1e-6) / 100]; })
      .filter(function (x) { return x[1] >= x[0]; });
  }
  function nearestFree(v, iv) {
    var best = null, bd = Infinity;
    iv.forEach(function (x) { var p = Math.min(x[1], Math.max(x[0], v)), d = Math.abs(p - v); if (d < bd) { bd = d; best = p; } });
    return best === null ? null : Math.round(best * 100) / 100;
  }
  // Everything the Dijamanti step and the scene need about where the stone
  // may go: preset positions, which are blocked and why, free intervals.
  function stoneLayout(s, g) {
    var half = stoneHalf(s, g), bounds = stoneBounds(s, half), forbidden = stoneForbidden(s, half);
    var presets = { levo: bounds.min, centar: 0, desno: bounds.max };
    var blocked = {};
    Object.keys(presets).forEach(function (k) { blocked[k] = blockerAt(presets[k], forbidden); });
    return { half: half, bounds: bounds, forbidden: forbidden, presets: presets, blocked: blocked, free: stoneFree(bounds, forbidden) };
  }
  // Resolved stone centre (band-centred mm) or null when it has no legal spot.
  function diamondWidthPos(s, g) {
    var L = stoneLayout(s, g);
    if (s.diamondPosMode === 'slobodno') return blockerAt(s.diamondPos || 0, L.forbidden) ? nearestFree(s.diamondPos || 0, L.free) : (s.diamondPos || 0);
    var m = L.presets[s.diamondPosMode] !== undefined ? s.diamondPosMode : 'centar';
    return L.blocked[m] ? null : L.presets[m];
  }
  var POS_LABEL = { levo: 'levo', centar: 'na sredini', desno: 'desno' };
  // After grooves/edges/width changed (they have priority): a stone whose
  // spot became blocked moves to the next free preset (centar → levo →
  // desno → nearest free spot); with no room at all it is taken off. The
  // customer is told why.
  Configurator.prototype.normalizeStone = function (s) {
    var g = this.c.groups || {};
    if (!stoneHalf(s, g)) return null;
    var L = stoneLayout(s, g);
    if (s.diamondPosMode === 'slobodno') {
      if (!blockerAt(s.diamondPos || 0, L.forbidden)) return null;
      var p = nearestFree(s.diamondPos || 0, L.free);
      if (p !== null) { s.diamondPos = p; return 'Kamen je pomeren na ' + fmtNum(p) + ' mm da ne bi dodirivao žleb.'; }
    } else {
      var cur = L.presets[s.diamondPosMode] !== undefined ? s.diamondPosMode : 'centar';
      if (!L.blocked[cur]) return null;
      var why = L.blocked[cur][2];
      var alt = ['centar', 'levo', 'desno'].filter(function (k) { return !L.blocked[k]; })[0];
      if (alt) { s.diamondPosMode = alt; return 'Kamen ne može ' + POS_LABEL[cur] + ' — tu je ' + why + '. Pomeren je ' + POS_LABEL[alt] + '.'; }
      if (L.free.length) { s.diamondPosMode = 'slobodno'; s.diamondPos = nearestFree(L.presets[cur], L.free); return 'Kamen ne može ' + POS_LABEL[cur] + ' — tu je ' + why + '. Pomeren je na ' + fmtNum(s.diamondPos) + ' mm.'; }
    }
    s.diamondSetting = 'none'; s.diamond = 'bez';
    return 'Kamen je uklonjen — sa ovim žlebovima nema mesta na prstenu na kome ga ne bi presekao žleb.';
  };

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
  // n is already a whole number (ceiled ring price / sum of them).
  var MONEY_FMT = (typeof Intl !== 'undefined') ? new Intl.NumberFormat('sr-RS', { maximumFractionDigits: 0, minimumFractionDigits: 0 }) : null;
  function money(n, c) {
    var cur = (c && c.pricing && c.pricing.currency) || (c && c.currency) || 'RSD';
    var v = Number(n) || 0;
    return (MONEY_FMT ? MONEY_FMT.format(v) : String(v).replace(/\B(?=(\d{3})+(?!\d))/g, '.')) + ' ' + cur;
  }
  function fmtMm2(n) { return (Math.round(Number(n) * 100) / 100).toFixed(2).replace('.', ','); }
  function fmtMass(g) { return (Number(g) || 0).toFixed(2).replace('.', ','); }  // display only

  document.addEventListener('click', function (e) {
    if (!e.target.closest('.zs-pattern-wrap')) {
      document.querySelectorAll('.zs-pattern-popover').forEach(function (n) { n.hidden = true; });
    }
  });

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
