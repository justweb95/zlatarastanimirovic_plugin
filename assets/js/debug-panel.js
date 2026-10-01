/*
 * ZS Configurator — TEMPORARY live-tuning panel for the shadow/light/pose
 * polish pass (Round 8, docs: memory "zsc-phase0-1-scaffold").
 *
 * Only does anything when the page URL has ?zscdebug=1 — otherwise this file
 * loads (it's only enqueued at all when that query var is present server-side,
 * see Configurator.php) and exits immediately, so it never touches the real
 * frontend. Renders a floating panel of <input type=range> sliders wired
 * directly to the main viewport's THREE.js objects (exposed via
 * `scene.debug`, see scene.module.js) — no page reload, no server round-trip.
 *
 * When the look is right: click "Kopiraj JSON", paste the result back into
 * the chat. Those numbers get baked into scene.module.js's real constants,
 * then this file + its enqueue + the `window.zscApp` hook in
 * configurator.js all get deleted.
 */
(function () {
  'use strict';
  if (!/[?&]zscdebug=/.test(location.search)) return;

  var RAD2DEG = 180 / Math.PI;
  var DEG2RAD = Math.PI / 180;

  function waitForScene(cb) {
    var tries = 0;
    (function poll() {
      if (window.zscApp && window.zscApp.scene && window.zscApp.scene.debug) {
        cb(window.zscApp.scene);
        return;
      }
      if (++tries > 200) { // ~30s — give up quietly rather than loop forever
        console.warn('[zsc-debug] scene never became ready, panel not built');
        return;
      }
      setTimeout(poll, 150);
    })();
  }

  waitForScene(buildPanel);

  function buildPanel(scene) {
    var dbg = scene.debug;

    function field(opts) {
      // opts: { label, min, max, step, get(): number, set(v), pose: bool }
      return opts;
    }

    // Full toolkit ON (client, 2026-09-10: "vrati sva podešavanja koja smo
    // imali") — pose (rot/offset per ring), camera polar range, and the
    // per-ring contact-AO blob sliders, alongside every light/reflection/
    // studio section below.
    var SHOW_POSITION_CONTROLS = true;

    var sections = [
      {
        title: 'Dijamant — oblik (rebuild geo)',
        fields: [
          field({ label: 'Veličina (prominence)', min: 0.5, max: 4, step: 0.05, stone: 'geo',
            get: function () { return dbg.stoneParams.prominence; },
            set: function (v) { dbg.stoneParams.prominence = v; } }),
          field({ label: 'Podignutost (raise)', min: 0.4, max: 2, step: 0.02, stone: 'geo',
            get: function () { return dbg.stoneParams.raise; },
            set: function (v) { dbg.stoneParams.raise = v; } }),
          field({ label: 'Tabela / Ø (tableRatio)', min: 0.35, max: 0.75, step: 0.01, stone: 'geo',
            get: function () { return dbg.stoneParams.tableRatio; },
            set: function (v) { dbg.stoneParams.tableRatio = v; } }),
          field({ label: 'Visina krune (crownH)', min: 0.10, max: 0.55, step: 0.01, stone: 'geo',
            get: function () { return dbg.stoneParams.crownH; },
            set: function (v) { dbg.stoneParams.crownH = v; } }),
          field({ label: 'Dubina paviliona (pavD)', min: 0.5, max: 1.3, step: 0.02, stone: 'geo',
            get: function () { return dbg.stoneParams.pavD; },
            set: function (v) { dbg.stoneParams.pavD = v; } }),
        ],
      },
      {
        title: 'Dijamant — materijal',
        fields: [
          field({ label: 'Env intensity (sjaj)', min: 0, max: 6, step: 0.1, stone: 'mat',
            get: function () { return dbg.stoneParams.envMapIntensity; },
            set: function (v) { dbg.stoneParams.envMapIntensity = v; } }),
          field({ label: 'Providnost (transmission)', min: 0, max: 1, step: 0.02, stone: 'mat',
            get: function () { return dbg.stoneParams.transmission; },
            set: function (v) { dbg.stoneParams.transmission = v; } }),
          field({ label: 'Hrapavost (roughness)', min: 0, max: 0.4, step: 0.005, decimals: 3, stone: 'mat',
            get: function () { return dbg.stoneParams.roughness; },
            set: function (v) { dbg.stoneParams.roughness = v; } }),
          field({ label: 'IOR', min: 1.3, max: 2.6, step: 0.02, stone: 'mat',
            get: function () { return dbg.stoneParams.ior; },
            set: function (v) { dbg.stoneParams.ior = v; } }),
          field({ label: 'Clearcoat rough.', min: 0, max: 0.3, step: 0.005, decimals: 3, stone: 'mat',
            get: function () { return dbg.stoneParams.clearcoatRoughness; },
            set: function (v) { dbg.stoneParams.clearcoatRoughness = v; } }),
          field({ label: 'Iridescence (duga)', min: 0, max: 1, step: 0.02, stone: 'mat',
            get: function () { return dbg.stoneParams.iridescence; },
            set: function (v) { dbg.stoneParams.iridescence = v; } }),
          field({ label: 'Disperzija — vatra (samo pravi GPU)', min: 0, max: 12, step: 0.5, stone: 'mat',
            get: function () { return dbg.stoneParams.dispersion; },
            set: function (v) { dbg.stoneParams.dispersion = v; } }),
        ],
      },
      {
        title: 'Dijamant — boje faseta (depth cue)',
        stoneColors: [
          { key: 'colTable', label: 'Tabela (vrh)' },
          { key: 'colCrown', label: 'Kruna' },
          { key: 'colGirdle', label: 'Rondiš (ivica)' },
          { key: 'colPav', label: 'Pavilion' },
          { key: 'colCulet', label: 'Kulet (dno)' },
        ],
      },
      {
        title: 'Dijamant — sparkle (lažni bljesak)',
        fields: [
          field({ label: 'Sparkle veličina', min: 0.3, max: 3, step: 0.05, stone: 'sparkle',
            get: function () { return dbg.stoneParams.sparkleScale; },
            set: function (v) { dbg.stoneParams.sparkleScale = v; } }),
          field({ label: 'Sparkle jačina (0 = isklj.)', min: 0, max: 1.5, step: 0.02, stone: 'sparkle',
            get: function () { return dbg.stoneParams.sparkleOpacity; },
            set: function (v) { dbg.stoneParams.sparkleOpacity = v; dbg.stoneParams.sparkle = v > 0.001; } }),
        ],
      },
      {
        title: 'Dijamant — presets',
        presets: [
          { label: 'Stilizovan (radi i bez GPU-a)',
            p: { transmission: 0.10, roughness: 0.05, envMapIntensity: 3.0, iridescence: 0.32,
                 dispersion: 4, sparkle: true, sparkleOpacity: 0.7 } },
          { label: 'CZ / moissanite (izbliza)',
            p: { transmission: 0.20, roughness: 0.03, envMapIntensity: 2.6, iridescence: 0.5,
                 dispersion: 6, sparkle: true, sparkleOpacity: 0.5 } },
          { label: 'Fotorealan (traži pravi GPU)',
            p: { transmission: 0.92, roughness: 0.0, envMapIntensity: 2.2, iridescence: 0.15,
                 dispersion: 9, sparkle: false, sparkleOpacity: 0 } },
        ],
      },
      {
        title: 'Glavno svetlo (key)',
        fields: [
          field({ label: 'X pozicija', min: -40, max: 40, step: 0.5,
            get: function () { return dbg.key.position.x; },
            set: function (v) { dbg.key.position.x = v; } }),
          field({ label: 'Y pozicija (visina)', min: 0, max: 50, step: 0.5,
            get: function () { return dbg.key.position.y; },
            set: function (v) { dbg.key.position.y = v; } }),
          field({ label: 'Z pozicija', min: -40, max: 40, step: 0.5,
            get: function () { return dbg.key.position.z; },
            set: function (v) { dbg.key.position.z = v; } }),
          field({ label: 'Jačina', min: 0, max: 5, step: 0.05,
            get: function () { return dbg.key.intensity; },
            set: function (v) { dbg.key.intensity = v; } }),
          field({ label: 'Mekoća senke (radius)', min: 0, max: 40, step: 1,
            get: function () { return dbg.key.shadow.radius; },
            set: function (v) { dbg.key.shadow.radius = v; } }),
          field({ label: 'Shadow bias', min: -0.005, max: 0.005, step: 0.0001, decimals: 4,
            get: function () { return dbg.key.shadow.bias; },
            set: function (v) { dbg.key.shadow.bias = v; } }),
        ],
      },
      {
        title: 'Fill/rim svetlo',
        fields: [
          field({ label: 'X pozicija', min: -30, max: 30, step: 0.5,
            get: function () { return dbg.rim.position.x; },
            set: function (v) { dbg.rim.position.x = v; } }),
          field({ label: 'Y pozicija', min: -30, max: 30, step: 0.5,
            get: function () { return dbg.rim.position.y; },
            set: function (v) { dbg.rim.position.y = v; } }),
          field({ label: 'Z pozicija', min: -30, max: 30, step: 0.5,
            get: function () { return dbg.rim.position.z; },
            set: function (v) { dbg.rim.position.z = v; } }),
          field({ label: 'Jačina', min: 0, max: 2, step: 0.02,
            get: function () { return dbg.rim.intensity; },
            set: function (v) { dbg.rim.intensity = v; } }),
        ],
      },
      {
        title: 'Pod (senka)',
        fields: [
          field({ label: 'Providnost senke', min: 0, max: 0.6, step: 0.01,
            get: function () { return dbg.ground.material.opacity; },
            set: function (v) { dbg.ground.material.opacity = v; } }),
        ],
      },
      {
        title: 'Studio — reflektor 1 (glavni)',
        fields: studioFields('key'),
      },
      {
        title: 'Studio — reflektor 2 (fill)',
        fields: studioFields('fill'),
      },
      {
        title: 'Studio — reflektor 3 (pozadina)',
        fields: studioFields('back'),
      },
      {
        title: 'Studio — pod i mekoća',
        fields: [
          field({ label: 'Nagib celog svetla (°) — pomera gde sjaj pada na kamenu', min: -45, max: 45, step: 1, env: true,
            get: function () { return dbg.studioParams.envTiltX * RAD2DEG; },
            set: function (v) { dbg.studioParams.envTiltX = v * DEG2RAD; } }),
          field({ label: 'Visina prstena u studiju', min: -20, max: 20, step: 0.5, env: true,
            get: function () { return dbg.studioParams.envOffsetY; },
            set: function (v) { dbg.studioParams.envOffsetY = v; } }),
          field({ label: 'Sjaj poda', min: 0.5, max: 3, step: 0.02, env: true,
            get: function () { return dbg.studioParams.floor; },
            set: function (v) { dbg.studioParams.floor = v; } }),
          field({ label: 'Mekoća odsjaja (blur)', min: 0.02, max: 0.4, step: 0.01, env: true,
            get: function () { return dbg.studioParams.blur; },
            set: function (v) { dbg.studioParams.blur = v; } }),
        ],
      },
    ].concat(SHOW_POSITION_CONTROLS ? POSITION_SECTIONS() : []);

    // Ring pose / camera angle / AO-blob placement — parked, not deleted (see
    // SHOW_POSITION_CONTROLS above). Kept as a function so building this list
    // doesn't run (and doesn't need dbg.POSE etc. touched) while it's off.
    function POSITION_SECTIONS() {
      return [
        {
          title: 'Kontakt-senka (AO mrlja) — Njena',
          fields: blobFields('her'),
        },
        {
          title: 'Kontakt-senka (AO mrlja) — Njegova',
          fields: blobFields('his'),
        },
        {
          title: 'Poza — Njena burma',
          fields: poseFields('her'),
        },
        {
          title: 'Poza — Njegova burma',
          fields: poseFields('his'),
        },
        {
          title: 'Kamera',
          fields: [
            field({ label: 'Min ugao (°, odozgo)', min: 0, max: 90, step: 1,
              get: function () { return dbg.controls.minPolarAngle * RAD2DEG; },
              set: function (v) { dbg.controls.minPolarAngle = v * DEG2RAD; dbg.controls.update(); } }),
            field({ label: 'Max ugao (°, odozgo)', min: 0, max: 180, step: 1,
              get: function () { return dbg.controls.maxPolarAngle * RAD2DEG; },
              set: function (v) { dbg.controls.maxPolarAngle = v * DEG2RAD; dbg.controls.update(); } }),
          ],
        },
      ];
    }

    function studioFields(panelKey) {
      var p = dbg.studioParams[panelKey];
      return [
        field({ label: 'X pozicija', min: -30, max: 30, step: 0.5, env: true,
          get: function () { return p.x; }, set: function (v) { p.x = v; } }),
        field({ label: 'Y pozicija', min: -20, max: 30, step: 0.5, env: true,
          get: function () { return p.y; }, set: function (v) { p.y = v; } }),
        field({ label: 'Z pozicija', min: -30, max: 30, step: 0.5, env: true,
          get: function () { return p.z; }, set: function (v) { p.z = v; } }),
        field({ label: 'Jačina (odsjaj)', min: 0, max: 6, step: 0.1, env: true,
          get: function () { return p.power; }, set: function (v) { p.power = v; } }),
      ];
    }

    function blobFields(ringKey) {
      return [
        field({ label: 'Visina (Y offset)', min: -0.5, max: 2, step: 0.01, pose: true,
          get: function () { return dbg.getBlobParams(ringKey).offsetY; },
          set: function (v) { dbg.setBlobParams(ringKey, { offsetY: v }); } }),
        field({ label: 'Širina (scale X)', min: 0.1, max: 2, step: 0.01, pose: true,
          get: function () { return dbg.getBlobParams(ringKey).scaleX; },
          set: function (v) { dbg.setBlobParams(ringKey, { scaleX: v }); } }),
        field({ label: 'Dubina (scale Y)', min: 0.1, max: 2, step: 0.01, pose: true,
          get: function () { return dbg.getBlobParams(ringKey).scaleY; },
          set: function (v) { dbg.setBlobParams(ringKey, { scaleY: v }); } }),
        field({ label: 'Providnost', min: 0, max: 1, step: 0.01, pose: true,
          get: function () { return dbg.getBlobParams(ringKey).opacity; },
          set: function (v) { dbg.setBlobParams(ringKey, { opacity: v }); } }),
      ];
    }

    function poseFields(key) {
      var pose = dbg.POSE[key];
      return [
        field({ label: 'Rotacija X (°)', min: -180, max: 180, step: 1, pose: true,
          get: function () { return pose.rot.x * RAD2DEG; },
          set: function (v) { pose.rot.x = v * DEG2RAD; } }),
        field({ label: 'Rotacija Y (°, yaw)', min: -180, max: 180, step: 1, pose: true,
          get: function () { return pose.rot.y * RAD2DEG; },
          set: function (v) { pose.rot.y = v * DEG2RAD; } }),
        field({ label: 'Rotacija Z (°)', min: -180, max: 180, step: 1, pose: true,
          get: function () { return pose.rot.z * RAD2DEG; },
          set: function (v) { pose.rot.z = v * DEG2RAD; } }),
        field({ label: 'Offset X (× radijus)', min: -2, max: 2, step: 0.01, pose: true,
          get: function () { return pose.off.x; },
          set: function (v) { pose.off.x = v; } }),
        field({ label: 'Offset Y — dodatno podizanje (× radijus)', min: -2, max: 2, step: 0.01, pose: true,
          get: function () { return pose.off.y; },
          set: function (v) { pose.off.y = v; } }),
        field({ label: 'Offset Z (× radijus)', min: -2, max: 2, step: 0.01, pose: true,
          get: function () { return pose.off.z; },
          set: function (v) { pose.off.z = v; } }),
      ];
    }

    // ------------------------------------------------------------- styling
    var style = document.createElement('style');
    style.textContent = [
      '#zsc-debug{position:fixed;top:0;right:0;z-index:999999;width:300px;max-height:100vh;',
      'overflow-y:auto;background:rgba(20,18,14,.94);color:#f2ede2;font:12px/1.4 ui-monospace,',
      'Menlo,Consolas,monospace;padding:10px 12px 16px;box-shadow:-2px 0 12px rgba(0,0,0,.35)}',
      '#zsc-debug h1{font-size:12px;margin:0 0 8px;display:flex;align-items:center;',
      'justify-content:space-between;color:#e6c181;letter-spacing:.02em}',
      '#zsc-debug h1 button{background:none;border:1px solid #665;color:#f2ede2;',
      'font:11px monospace;padding:2px 6px;cursor:pointer;border-radius:3px}',
      '#zsc-debug .zsc-actions{display:flex;gap:6px;margin-bottom:10px}',
      '#zsc-debug .zsc-actions button{flex:1;background:#e6c181;color:#221c10;border:0;',
      'padding:6px 4px;font:11px/1 ui-monospace,monospace;font-weight:600;border-radius:3px;',
      'cursor:pointer}',
      '#zsc-debug .zsc-actions button.secondary{background:#3a352b;color:#f2ede2}',
      '#zsc-debug fieldset{border:1px solid #3a352b;border-radius:4px;margin:0 0 8px;padding:6px 8px 8px}',
      '#zsc-debug legend{font-size:10.5px;color:#c7bfa9;text-transform:uppercase;',
      'letter-spacing:.04em;padding:0 4px}',
      '#zsc-debug label{display:flex;justify-content:space-between;gap:6px;margin-top:6px;',
      'font-size:11px;color:#e8e2d3}',
      '#zsc-debug label span{color:#8fa;font-variant-numeric:tabular-nums}',
      '#zsc-debug input[type=range]{width:100%;display:block;margin-top:2px;accent-color:#e6c181}',
      '#zsc-debug.zsc-collapsed fieldset,#zsc-debug.zsc-collapsed .zsc-actions{display:none}',
      '#zsc-debug .zsc-note{font-size:10px;color:#a89;margin:0 0 8px;line-height:1.5}',
    ].join('');
    document.head.appendChild(style);

    var root = document.createElement('div');
    root.id = 'zsc-debug';
    document.body.appendChild(root);

    var h1 = document.createElement('h1');
    h1.textContent = 'ZSC Debug (privremeno)';
    var collapseBtn = document.createElement('button');
    collapseBtn.type = 'button';
    collapseBtn.textContent = '—';
    collapseBtn.addEventListener('click', function () {
      root.classList.toggle('zsc-collapsed');
      collapseBtn.textContent = root.classList.contains('zsc-collapsed') ? '+' : '—';
    });
    h1.appendChild(collapseBtn);
    root.appendChild(h1);

    var note = document.createElement('p');
    note.className = 'zsc-note';
    note.textContent = 'Fokus: DIJAMANT (gornje sekcije). Izaberi kamen u panelu desno da se pojavi. '
      + 'Vrti sliku, menjaj klizače/boje, probaj presete. Kad je dobro → "Kopiraj JSON" → pošalji u chat.';
    root.appendChild(note);

    var actions = document.createElement('div');
    actions.className = 'zsc-actions';
    var copyBtn = document.createElement('button');
    copyBtn.type = 'button';
    copyBtn.textContent = 'Kopiraj JSON';
    var resetBtn = document.createElement('button');
    resetBtn.type = 'button';
    resetBtn.className = 'secondary';
    resetBtn.textContent = 'Reset';
    actions.appendChild(copyBtn);
    actions.appendChild(resetBtn);
    root.appendChild(actions);

    var defaults = []; // parallel to every field, in build order, for Reset

    sections.forEach(function (section) {
      var fs = document.createElement('fieldset');
      var legend = document.createElement('legend');
      legend.textContent = section.title;
      fs.appendChild(legend);

      if (section.stoneColors) {
        section.stoneColors.forEach(function (sc) {
          var r = document.createElement('label');
          var t = document.createElement('span');
          t.textContent = sc.label;
          r.appendChild(t);
          var inp = document.createElement('input');
          inp.type = 'color';
          inp.value = dbg.stoneParams[sc.key];
          inp.style.cssText = 'width:96px;height:22px;border:1px solid #3a352b;background:none;cursor:pointer;';
          inp.addEventListener('input', function () {
            dbg.stoneParams[sc.key] = inp.value;
            dbg.rebuildStone();
          });
          r.appendChild(inp);
          fs.appendChild(r);
        });
        root.appendChild(fs);
        return;
      }

      if (section.presets) {
        section.presets.forEach(function (pr) {
          var b = document.createElement('button');
          b.type = 'button';
          b.textContent = pr.label;
          b.style.cssText = 'display:block;width:100%;margin-top:5px;padding:6px 4px;background:#3a352b;'
            + 'color:#f2ede2;border:1px solid #665;border-radius:3px;cursor:pointer;font:11px monospace;';
          b.addEventListener('click', function () {
            var k;
            for (k in pr.p) if (Object.prototype.hasOwnProperty.call(pr.p, k)) dbg.stoneParams[k] = pr.p[k];
            dbg.setStoneMat();
            dbg.setSparkle();
            dbg.rebuildStone();
          });
          fs.appendChild(b);
        });
        root.appendChild(fs);
        return;
      }

      section.fields.forEach(function (f) {
        var current = f.get();
        defaults.push({ field: f, value: current });

        var label = document.createElement('label');
        var text = document.createElement('span');
        text.textContent = f.label;
        var val = document.createElement('span');
        val.textContent = fmt(current, f.decimals);
        label.appendChild(text);
        label.appendChild(val);

        var input = document.createElement('input');
        input.type = 'range';
        input.min = f.min;
        input.max = f.max;
        input.step = f.step;
        input.value = current;

        input.addEventListener('input', function () {
          var v = parseFloat(input.value);
          f.set(v);
          val.textContent = fmt(v, f.decimals);
          if (f.pose) dbg.refreshPose();
          if (f.env) dbg.rebuildEnvironment();
          if (f.stone === 'geo') dbg.rebuildStone();
          else if (f.stone === 'mat') dbg.setStoneMat();
          else if (f.stone === 'sparkle') dbg.setSparkle();
          dbg.invalidate(20);
        });

        fs.appendChild(label);
        fs.appendChild(input);
        f._input = input;
        f._val = val;
      });

      root.appendChild(fs);
    });

    resetBtn.addEventListener('click', function () {
      defaults.forEach(function (d) {
        d.field.set(d.value);
        d.field._input.value = d.value;
        d.field._val.textContent = fmt(d.value, d.field.decimals);
      });
      dbg.refreshPose();
      if (dbg.setStoneMat) { dbg.setStoneMat(); dbg.setSparkle(); dbg.rebuildStone(); }
      dbg.invalidate(30);
    });

    copyBtn.addEventListener('click', function () {
      var json = JSON.stringify(collectState(), null, 2);
      copyToClipboard(json, copyBtn);
    });

    function fmt(v, decimals) {
      return v.toFixed(typeof decimals === 'number' ? decimals : 2);
    }

    function collectState() {
      return {
        key: {
          position: [dbg.key.position.x, dbg.key.position.y, dbg.key.position.z],
          intensity: dbg.key.intensity,
          shadowRadius: dbg.key.shadow.radius,
          shadowBias: dbg.key.shadow.bias,
        },
        rim: {
          position: [dbg.rim.position.x, dbg.rim.position.y, dbg.rim.position.z],
          intensity: dbg.rim.intensity,
        },
        groundOpacity: dbg.ground.material.opacity,
        blob: {
          her: dbg.getBlobParams('her'),
          his: dbg.getBlobParams('his'),
        },
        pose: {
          her: { rot: eulerArr(dbg.POSE.her.rot), off: vecArr(dbg.POSE.her.off) },
          his: { rot: eulerArr(dbg.POSE.his.rot), off: vecArr(dbg.POSE.his.off) },
        },
        camera: {
          minPolarAngle: dbg.controls.minPolarAngle,
          maxPolarAngle: dbg.controls.maxPolarAngle,
        },
        studio: JSON.parse(JSON.stringify(dbg.studioParams)),
        stone: JSON.parse(JSON.stringify(dbg.stoneParams)),
      };
    }

    function eulerArr(e) { return [e.x, e.y, e.z]; }
    function vecArr(v) { return [v.x, v.y, v.z]; }

    function copyToClipboard(text, btn) {
      var done = function (ok) {
        var old = btn.textContent;
        btn.textContent = ok ? 'Kopirano!' : 'Nije uspelo — vidi konzolu';
        setTimeout(function () { btn.textContent = old; }, 1500);
      };
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(function () { done(true); }, function () {
          console.log('[zsc-debug] JSON:\n' + text);
          done(false);
        });
        return;
      }
      try {
        var ta = document.createElement('textarea');
        ta.value = text;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
        done(true);
      } catch (e) {
        console.log('[zsc-debug] JSON:\n' + text);
        done(false);
      }
    }
  }
})();
