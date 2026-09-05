/*
 * ZS Configurator — frontend (Faza 0/1).
 *
 * Real UI shell matching the client mockup (image 2 (1).png / Figma
 * "Stanimirović - konfigurator"): top bar, 7-step nav, left model list,
 * centre viewport with tool rail, right accordion panel, bottom price bar.
 *
 * The 3D viewport is a placeholder: it shows a per-material render image when
 * one is set on the model (params.renders[<material-slug>] or .default). The
 * real-time three.js scene lands in Faza 2 and replaces only .zs-view contents.
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

  var STEPS = ['Model', 'Materijal', 'Profil', 'Širina', 'Završna obrada', 'Dijamanti', 'Gravura'];
  var RINGS = [{ key: 'her', label: 'Njena burma' }, { key: 'his', label: 'Njegova burma' }];

  // Thin, consistent line-icon set (24x24, stroke=currentColor) — replaces the
  // old Unicode glyphs (↺ ▶ ◉ ⛬) in the viewport rail/toolbar, which rendered
  // inconsistently across fonts/OSes and read as "unstyled" rather than as a
  // designed product.
  var ICON_SVG = {
    orbit: '<path d="M20 12a8 8 0 1 1-2.6-5.9"/><path d="M20 4v4h-4"/>',
    reset: '<circle cx="12" cy="12" r="7.2"/><circle cx="12" cy="12" r="1.4" fill="currentColor" stroke="none"/><path d="M12 2.6v2.6M12 18.8v2.6M2.6 12h2.6M18.8 12h2.6"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    minus: '<path d="M5 12h14"/>',
    camera: '<path d="M4 8h3l1.5-2h7L17 8h3a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1Z"/><circle cx="12" cy="13" r="3.2"/>',
    expand: '<path d="M9 4H5a1 1 0 0 0-1 1v4M15 4h4a1 1 0 0 1 1 1v4M9 20H5a1 1 0 0 1-1-1v-4M15 20h4a1 1 0 0 0 1-1v-4"/>',
    heart: '<path d="M12 20s-7-4.35-9.5-8.8C1 8 2.4 5 5.6 5c1.9 0 3.3 1 4.4 2.6C11.1 6 12.5 5 14.4 5 17.6 5 19 8 18.5 11.2 16 15.65 12 20 12 20Z"/>',
    share: '<path d="M12 4v11"/><path d="M8 8l4-4 4 4"/><path d="M5 14v4a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-4"/>'
  };
  function icon(name, cls) {
    return '<svg class="zs-icon' + (cls ? ' ' + cls : '') + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" ' +
      'stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + ICON_SVG[name] + '</svg>';
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
    this.c = boot.config || {};
    this.activeRing = 'her';
    this.openSections = { Materijal: true, Profil: true, 'Širina': true };
    this.state = { her: this.defaultState(), his: this.defaultState() };
  }

  Configurator.prototype.defaultState = function () {
    var c = this.c, g = c.groups || {};
    var model = (c.model && c.model.slug) || firstSlug(c.models);
    var shank = (c.model && c.model.shank) || {};
    return {
      model: model,
      material: firstAvail(g.material),
      profile: (c.model && c.model.profile) || firstSlug(g.profile),
      finish: firstAvail(g.finish),
      diamond: firstAvail(g.diamond),
      width: num(g.width && g.width.default, shank.width && shank.width.default, 4),
      thickness: num(g.thickness && g.thickness.default, shank.thickness && shank.thickness.default, 1.4),
      size: num(shank.size && shank.size.default, 54),
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
    shell.appendChild(this.buildModels());
    shell.appendChild(this.buildView());
    shell.appendChild(this.buildPanel());
    r.appendChild(shell);
    r.appendChild(this.buildBottombar());
    this.refresh();
    this.initScene();
    this.initThumbScene();
  };

  /* --------------------------------------------------------------- 3D scene */

  // A second, single-ring scene rendered into a small off-screen canvas —
  // used to give the model list REAL rendered thumbnails (same materials/
  // lighting as the main viewport) instead of flat placeholder swatches.
  Configurator.prototype.initThumbScene = function () {
    var self = this;
    if (this._thumbScene || this._thumbCanvas) return;
    var host = el('div');
    host.style.cssText = 'position:fixed;left:-9999px;top:0;width:160px;height:160px;pointer-events:none;';
    host.setAttribute('aria-hidden', 'true');
    var canvas = el('canvas');
    host.appendChild(canvas);
    document.body.appendChild(host);
    this._thumbCanvas = canvas;
    this._thumbCache = {};
    if (window.ZSCScene && window.ZSCScene.create) {
      this._thumbScene = window.ZSCScene.create(canvas, {});
      this.renderModelThumbs();
    } else {
      document.addEventListener('zsc:scene-ready', function () { self.initThumbScene(); }, { once: true });
    }
  };

  Configurator.prototype.modelThumbState = function (model, materialSlug) {
    var g = this.c.groups || {}, shank = model.shank || {};
    var mat = bySlug(g.material, materialSlug);
    var pbr = (mat && mat.params && mat.params.pbr) || {};
    var profSlug = model.profile || firstSlug(g.profile);
    var prof = bySlug(g.profile, profSlug);
    var dia = (g.diamond || [])[0];
    var hasStone = /kamen/.test(model.slug || '');
    return {
      width: num(shank.width && shank.width.default, g.width && g.width.default, 4),
      thickness: num(shank.thickness && shank.thickness.default, g.thickness && g.thickness.default, 1.4),
      size: num(shank.size && shank.size.default, 54),
      profileShape: (prof && prof.params && prof.params.shape) || 'flat',
      materialColor: pbr.color || '#E6C181',
      roughness: typeof pbr.roughness === 'number' ? pbr.roughness : 0.08,
      envIntensity: 1.2, // dimmed from 1.9 — that value only started actually reaching the
      // material once scene.module.js got an explicit envMap (?zscdebug=1 session); at 1.9
      // it read as too bright/blown-out. Fine-tune further via the "Odsjaj" debug panel.
      stone: hasStone ? { mm: num(dia && dia.params && dia.params.mm, 1.5), position: 0 } : null
    };
  };

  // Renders (and caches, per model+material) one thumbnail per model into the
  // hidden thumb scene, then paints the resulting PNG onto the matching list
  // item. Re-run whenever the active ring's material changes.
  Configurator.prototype.renderModelThumbs = function () {
    if (!this._thumbScene || !this._modelList) return;
    var self = this;
    var materialSlug = this.cur().material;
    (this.c.models || []).forEach(function (m) {
      var key = m.slug + '|' + materialSlug;
      var url = self._thumbCache[key];
      if (!url) {
        self._thumbScene.setState(self.modelThumbState(m, materialSlug));
        url = self._thumbScene.screenshot(1);
        self._thumbCache[key] = url;
      }
      var thumbEl = self._modelList.querySelector('.zs-model[data-slug="' + cssEsc(m.slug) + '"] .zs-model-thumb');
      if (thumbEl && url) thumbEl.style.backgroundImage = "url('" + url + "')";
    });
  };

  Configurator.prototype.initScene = function () {
    var self = this;
    if (this.scene || !this._canvas) return;
    if (window.ZSCScene && window.ZSCScene.create) {
      this.scene = window.ZSCScene.create(this._canvas, { pair: true });
      this._view.classList.add('has-3d');
      this.pushScene();
      // TEMPORARY (commented out with the panel's enqueue in
      // Configurator.php — see there): exposes the app for the ?zscdebug=1
      // live-tuning panel (assets/js/debug-panel.js). Uncomment alongside
      // that block to bring the panel back.
      // if (/[?&]zscdebug=/.test(location.search)) window.zscApp = this;
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
      ? { mm: dia.params.mm, position: s.diamondPos || 0 } : null;
    return {
      width: s.width, thickness: s.thickness, size: s.size,
      profileShape: (prof && prof.params && prof.params.shape) || 'flat',
      materialColor: pbr.color || '#E6C181',
      roughness: typeof finPbr.roughness === 'number' ? finPbr.roughness : (pbr.roughness || 0.08),
      envIntensity: finPbr.anisotropy ? 1.0 : 1.2, // dimmed, see modelThumbState()'s note
      stone: stone
    };
  };

  Configurator.prototype.pushScene = function () {
    if (!this.scene) return;
    this.scene.setState({ her: this.sceneStateFor('her'), his: this.sceneStateFor('his') });
  };

  /* ------------------------------------------------------------------- topbar */

  Configurator.prototype.buildTopbar = function () {
    var bar = el('div', 'zs-topbar');
    bar.innerHTML =
      '<button type="button" class="zs-topbar-back">&larr; Nazad na kolekciju</button>' +
      '<div class="zs-brand">' +
        '<span class="zs-brand-mark">&#9670;</span>' +
        '<span class="zs-brand-text"><strong>Zlatara Stanimirović</strong><em>Burme po meri</em></span>' +
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
    if (label === 'Model') {
      this._modelsCol.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      return;
    }
    this.openSections[label] = true;
    this.renderPanel();
    var sec = this._panel.querySelector('[data-section="' + cssEsc(label) + '"]');
    if (sec) sec.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  /* ------------------------------------------------------------------- models */

  Configurator.prototype.buildModels = function () {
    var col = el('div', 'zs-col zs-col-models');
    this._modelsCol = col;
    col.appendChild(hx('p', 'zs-eyebrow', 'Odaberite model'));
    var ul = el('ul', 'zs-model-list');
    var self = this;
    (this.c.models || []).forEach(function (m) {
      var li = el('li');
      var b = el('button', 'zs-model');
      b.type = 'button';
      b.dataset.slug = m.slug;
      var thumb = renderUrl(m, self.cur().material) || renderUrl(m, null);
      b.innerHTML =
        '<span class="zs-model-thumb"' + (thumb ? ' style="background-image:url(\'' + esc(thumb) + '\')"' : '') + '></span>' +
        '<span class="zs-model-meta"><span class="zs-model-name">' + esc(m.label) + '</span>' +
        '<span class="zs-model-desc">' + esc(modelDesc(m)) + '</span></span>' +
        '<span class="zs-model-check" aria-hidden="true">&#10003;</span>';
      b.addEventListener('click', function () { self.cur().model = m.slug; self.refresh(); });
      li.appendChild(b);
      ul.appendChild(li);
    });
    col.appendChild(ul);
    this._modelList = ul;
    return col;
  };

  /* ----------------------------------------------------------------- viewport */

  Configurator.prototype.buildView = function () {
    var col = el('div', 'zs-col zs-col-view');

    var tabs = el('div', 'zs-ring-tabs');
    var self = this;
    RINGS.forEach(function (t) {
      var b = el('button', 'zs-ring-tab');
      b.type = 'button';
      b.textContent = t.label;
      b.addEventListener('click', function () { self.activeRing = t.key; self.refresh(); });
      tabs.appendChild(b);
    });
    col.appendChild(tabs);
    this._ringTabs = tabs;

    var stage = el('div', 'zs-view');
    stage.innerHTML =
      '<canvas class="zs-view-canvas"></canvas>' +
      '<div class="zs-view-placeholder">' +
        '<span class="zs-view-mark">&#9670;</span>' +
        '<strong>Učitavanje 3D prikaza…</strong>' +
        '<span>Ako se ne pojavi, prikazuje se render iz opcije modela (ako je zadat).</span>' +
      '</div>' +
      '<div class="zs-view-rail">' +
        railBtn('rotate', icon('orbit'), 'Auto-rotacija') + railBtn('reset', icon('reset'), 'Resetuj pogled') +
        railBtn('zin', icon('plus'), 'Uvećaj') + railBtn('zout', icon('minus'), 'Umanji') +
      '</div>';
    col.appendChild(stage);
    this._view = stage;
    this._canvas = stage.querySelector('.zs-view-canvas');

    var self = this;
    stage.querySelector('.zs-view-rail').addEventListener('click', function (e) {
      var btn = e.target.closest('.zs-rail-btn'); if (!btn || !self.scene) return;
      var k = btn.dataset.k;
      if (k === 'rotate') self.scene.setAutoRotate();
      else if (k === 'reset') self.scene.reset();
      else if (k === 'zin') self.scene.zoom(0.82);
      else if (k === 'zout') self.scene.zoom(1.22);
    });

    var toolbar = el('div', 'zs-view-toolbar');
    toolbar.innerHTML =
      toolBtn(icon('reset'), 'Reset') + toolBtn(icon('orbit'), 'Rotacija') +
      toolBtn(icon('camera'), 'Slika') + toolBtn(icon('expand'), 'Pun ekran');
    toolbar.addEventListener('click', function (e) {
      var btn = e.target.closest('.zs-tool-btn'); if (!btn) return;
      var label = btn.textContent.trim();
      if (label === 'Reset' && self.scene) self.scene.reset();
      else if (label === 'Rotacija' && self.scene) self.scene.setAutoRotate();
      else if (label === 'Slika' && self.scene) { var u = self.scene.screenshot(2); if (u) window.open(u, '_blank'); }
      else if (label === 'Pun ekran') { (stage.requestFullscreen ? stage.requestFullscreen() : 0); }
    });
    col.appendChild(toolbar);

    return col;
  };

  /* -------------------------------------------------------------------- panel */

  Configurator.prototype.buildPanel = function () {
    var col = el('div', 'zs-col zs-col-panel');
    this._panel = col;
    var self = this;
    col.addEventListener('change', function () { self.recalc(); self.updateRender(); });
    col.addEventListener('input', function () { self.recalc(); });
    return col;
  };

  Configurator.prototype.renderPanel = function () {
    var p = this._panel;
    p.innerHTML = '';
    var s = this.cur(), g = this.c.groups || {};
    p.dataset.ring = this.activeRing;

    p.appendChild(this.section('Materijal', 2, this.uiSwatches(g.material, s.material, function (v) { s.material = v; })));
    p.appendChild(this.section('Profil', 3, this.uiChips(g.profile, s.profile, function (v) { s.profile = v; })));
    p.appendChild(this.section('Širina', 4, this.uiSize(g, s)));
    p.appendChild(this.section('Završna obrada', 5, this.uiChips(g.finish, s.finish, function (v) { s.finish = v; })));
    p.appendChild(this.section('Dijamanti', 6, this.uiDiamonds(g.diamond, s)));
    p.appendChild(this.section('Gravura', 7, this.uiEngraving(g.engraving, s)));
  };

  Configurator.prototype.uiDiamonds = function (list, s) {
    var box = el('div');
    var self = this;
    box.appendChild(this.uiChips(list, s.diamond, function (v) { s.diamond = v; self.refresh(); }));
    var sel = bySlug(list, s.diamond);
    if (sel && sel.params && sel.params.positionable) {
      var r = sel.params.posRange || { min: -10, max: 10, step: 0.5, unit: 'mm' };
      var row = el('div', 'zs-slider');
      row.style.marginTop = '16px';
      row.innerHTML = '<div class="zs-slider-top"><span>Pozicija kamena</span><span class="zs-slider-val">' +
        fmtNum(s.diamondPos) + ' ' + (r.unit || 'mm') + '</span></div>';
      var input = el('input');
      input.type = 'range'; input.min = r.min; input.max = r.max; input.step = r.step || 0.5; input.value = s.diamondPos;
      var out = row.querySelector('.zs-slider-val');
      input.addEventListener('input', function () {
        s.diamondPos = parseFloat(input.value);
        out.textContent = fmtNum(s.diamondPos) + ' ' + (r.unit || 'mm');
      });
      row.appendChild(input);
      box.appendChild(row);
    }
    return box;
  };

  Configurator.prototype.section = function (label, num, body) {
    var sec = el('section', 'zs-acc');
    sec.dataset.section = label;
    var open = !!this.openSections[label];
    if (open) sec.classList.add('is-open');
    var head = el('button', 'zs-acc-head');
    head.type = 'button';
    head.innerHTML = '<span class="zs-acc-title"><span class="zs-acc-n">' + num + '.</span> ' + esc(label.toUpperCase()) + '</span>' +
      '<span class="zs-acc-chevron" aria-hidden="true">&#8250;</span>';
    var self = this;
    head.addEventListener('click', function () {
      self.openSections[label] = !self.openSections[label];
      sec.classList.toggle('is-open', self.openSections[label]);
    });
    var wrap = el('div', 'zs-acc-body');
    wrap.appendChild(body);
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

  Configurator.prototype.uiSize = function (g, s) {
    var box = el('div', 'zs-sliders');
    box.appendChild(slider('Širina', g.width || { min: 3, max: 8, step: 0.5, unit: 'mm' }, s.width, function (v) { s.width = v; }));
    box.appendChild(slider('Debljina', g.thickness || { min: 1, max: 2.5, step: 0.1, unit: 'mm' }, s.thickness, function (v) { s.thickness = v; }));
    box.appendChild(sizeRow('Veličina (EU)', { min: 44, max: 68, step: 1 }, s.size, function (v) { s.size = v; }));
    return box;

    function slider(label, cfg, val, set) {
      var row = el('div', 'zs-slider');
      row.innerHTML = '<div class="zs-slider-top"><span>' + esc(label) + '</span><span class="zs-slider-val">' +
        fmtNum(val) + ' ' + (cfg.unit || 'mm') + '</span></div>';
      var input = el('input');
      input.type = 'range'; input.min = cfg.min; input.max = cfg.max; input.step = cfg.step || 0.1; input.value = val;
      var out = row.querySelector('.zs-slider-val');
      input.addEventListener('input', function () { set(parseFloat(input.value)); out.textContent = fmtNum(input.value) + ' ' + (cfg.unit || 'mm'); });
      row.appendChild(input);
      var ticks = el('div', 'zs-slider-ticks');
      for (var v = cfg.min; v <= cfg.max + 1e-9; v += (cfg.max - cfg.min) / 4) ticks.appendChild(hx('span', '', fmtNum(v)));
      row.appendChild(ticks);
      return row;
    }
    function sizeRow(label, cfg, val, set) {
      var row = el('div', 'zs-slider');
      row.innerHTML = '<div class="zs-slider-top"><span>' + esc(label) + '</span><span class="zs-slider-val">' + val + '</span></div>';
      var input = el('input');
      input.type = 'range'; input.min = cfg.min; input.max = cfg.max; input.step = 1; input.value = val;
      var out = row.querySelector('.zs-slider-val');
      input.addEventListener('input', function () { set(parseInt(input.value, 10)); out.textContent = input.value; });
      row.appendChild(input);
      return row;
    }
  };

  Configurator.prototype.uiEngraving = function (e, s) {
    var box = el('div', 'zs-engrave');
    if (!e) { box.appendChild(hx('p', 'zs-micro', 'Nije podešeno.')); return box; }
    var input = el('input');
    input.type = 'text'; input.maxLength = e.maxLen || 20;
    input.placeholder = 'Tekst gravure (do ' + (e.maxLen || 20) + ' znakova)';
    input.value = s.engravingText;
    input.addEventListener('input', function () { s.engravingText = input.value; });
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
    return bar;
  };

  /* ------------------------------------------------------------------ refresh */

  Configurator.prototype.cur = function () { return this.state[this.activeRing]; };

  Configurator.prototype.refresh = function () {
    this.renderPanel();
    var s = this.cur();
    this._modelList.querySelectorAll('.zs-model').forEach(function (b) {
      b.setAttribute('aria-pressed', String(b.dataset.slug === s.model));
    });
    var self = this;
    this._ringTabs.querySelectorAll('.zs-ring-tab').forEach(function (b, i) {
      b.setAttribute('aria-selected', String(RINGS[i].key === self.activeRing));
    });
    this._steps.querySelectorAll('.zs-step').forEach(function (b) {
      b.classList.toggle('is-active', b.dataset.step === 'Model');
    });
    this.updateRender();
    this.recalc();
    this.pushScene();
  };

  Configurator.prototype.updateRender = function () {
    var s = this.cur();
    var model = bySlug(this.c.models, s.model);
    var img = this._view.querySelector('img.zs-view-img');
    // The live 3D scene owns the viewport; the render image is only a fallback
    // for when WebGL isn't available / the module failed to load.
    var url = this.scene ? '' : renderUrl(model, s.material);
    if (url) {
      if (!img) { img = document.createElement('img'); img.className = 'zs-view-img'; this._view.insertBefore(img, this._view.firstChild); }
      img.src = url; img.alt = model ? model.label : '';
    } else if (img) { img.remove(); }
    // Live 3D thumbnails per model, matched to the active ring's material.
    this.renderModelThumbs();
  };

  Configurator.prototype.recalc = function () {
    var her = this._ringPrice('her'), his = this._ringPrice('his');
    var total = her.total + his.total;
    var priceable = her.priceable && his.priceable;
    var wPair = this.ringWeight('her') + this.ringWeight('his');
    if (this._weightEl) this._weightEl.textContent = wPair > 0 ? ('≈ ' + fmtNum(wPair) + ' g za par') : '';
    if (this._priceValue) this._priceValue.textContent = priceable ? money(Math.round(total), this.c) : 'Cena na upit';
    this.pushScene();
  };

  Configurator.prototype._ringPrice = function (ringKey) {
    var c = this.c, g = c.groups || {}, s = this.state[ringKey];
    var model = bySlug(c.models, s.model) || {};
    var mat = bySlug(g.material, s.material);
    var weight = this.ringWeight(ringKey);
    var total = model.basePrice || 0;
    var priceable = true;

    if (mat && mat.price && mat.price.type === 'per_gram') {
      var perGram = (c.pricing && c.pricing.spotPrices && c.pricing.spotPrices[mat.price.spot_key]) || 0;
      if (perGram > 0) total += weight * perGram;
      else priceable = false;
    }
    total += flat(bySlug(g.finish, s.finish));
    total += flat(bySlug(g.diamond, s.diamond));
    if (s.engravingText && g.engraving && g.engraving.price) total += g.engraving.price.amount || 0;
    return { total: total, priceable: priceable };
  };

  // client's jeweller formula → grams for one ring
  Configurator.prototype.ringWeight = function (ringKey) {
    var c = this.c, g = c.groups || {}, s = this.state[ringKey];
    var model = bySlug(c.models, s.model) || {};
    var mat = bySlug(g.material, s.material);
    var prof = bySlug(g.profile, s.profile);
    var density = (mat && mat.price && mat.price.density) || 0;
    if (!density) return 0;
    var fill = num(prof && prof.params && prof.params.fill, model.fill, 1.0);
    var meanCirc = s.size + Math.PI * s.thickness;      // mm
    var area = s.width * s.thickness * fill;            // mm²
    var volume_cm3 = area * meanCirc / 1000;
    return volume_cm3 * density;                        // g
  };

  /* -------------------------------------------------------------- tiny helpers */

  function railBtn(k, glyph, title) { return '<button type="button" class="zs-rail-btn" data-k="' + k + '" title="' + title + '" aria-label="' + title + '">' + glyph + '</button>'; }
  function toolBtn(glyph, label) { return '<button type="button" class="zs-tool-btn"><span aria-hidden="true">' + glyph + '</span>' + esc(label) + '</button>'; }
  function trust(a, b) { return '<div class="zs-trust-item"><strong>' + esc(a) + '</strong><span>' + esc(b) + '</span></div>'; }

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
  function renderUrl(model, materialSlug) {
    if (!model || !model.params) return '';
    var r = model.params.renders || {};
    return (materialSlug && r[materialSlug]) || r.default || model.params.render || '';
  }
  function modelDesc(m) {
    var d = { 'ravna': 'Minimalistička i čista', 'zaobljena': 'Klasična, udobna',
      'ravna-kamen': 'Ravna sa utisnutim kamenom', 'zaobljena-kamen': 'Zaobljena sa utisnutim kamenom' };
    return d[m.slug] || (m.params && m.params.preset === 'band' ? 'Burma' : '');
  }
  function swatchGradient(hex) { return 'radial-gradient(circle at 32% 28%, #fff 0%, ' + hex + ' 42%, ' + shade(hex, -0.35) + ' 100%)'; }
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

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
