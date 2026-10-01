// Faza 4 check (browser): FAZA4 §24 price cases through OUR price code
// (configurator.js _ringPrice) with Wama's numbers typed in as CMS values.
// Needs playwright-core (npm i playwright-core@1 in a scratch dir) and the
// local site; see docs/STATUS.md "Kako testiramo".
//   PLAYWRIGHT_CORE=<scratch>/node_modules/playwright-core/index.mjs \
//     node docs/faza4/tools/check_prices_browser.mjs
import fs from 'fs';
const { chromium } = await import(process.env.PLAYWRIGHT_CORE || 'playwright-core');
const exe = fs.readdirSync(process.env.HOME + '/.cache/ms-playwright').filter((d) => d.startsWith('chromium_headless_shell'))[0];
const path = `${process.env.HOME}/.cache/ms-playwright/${exe}/chrome-headless-shell-linux64/chrome-headless-shell`;
async function open(url = 'http://localhost/zlatarastanimirovic/', vp = { width: 1440, height: 900 }) {
  const browser = await chromium.launch({ executablePath: path, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const page = await browser.newPage({ viewport: vp });
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errors.push(m.type() + ': ' + m.text()); });
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => window.__zscApp && window.__zscApp.scene, null, { timeout: 30000 });
  await page.waitForTimeout(1500);
  return { browser, page, errors };
}
const { browser, page, errors } = await open();
const res = await page.evaluate(() => {
  const a = __zscApp, c = a.c, RG = window.ZSCScene.geometry;
  // ---- Wama numbers as our CMS values (PLN = "RSD" here), FAZA4 §22 / price_per_gram_matrix.md
  c.pricing.spotPrices = { au_8k: 237, au_9k: 260, au_14k: 371, au_18k: 459 };
  const cls = { '333': [253, 270, 305], '375': [275, 293, 327], '585': [384, 398, 427], '750': [471, 483, 508] };
  const base = { '333': 237, '375': 260, '585': 371, '750': 459 };
  const rho = { '333': 10.9, '375': 11.2, '585': 13.3, '750': 15.5 };
  c.pricing.finoce = ['333', '375', '585', '750'].map((id) => ({
    id, label: id, sub: '', price_key: { '333': 'au_8k', '375': 'au_9k', '585': 'au_14k', '750': 'au_18k' }[id], enabled: 1,
    density: { zuto: rho[id], belo: rho[id], crveno: rho[id], manganovo: id === '585' ? 12.2 : 0, 'belo-pd': id === '585' ? 14.8 : 0 },
    class_extra: { special: cls[id][0] - base[id], multi: cls[id][1] - base[id], wavy: cls[id][2] - base[id] },
  }));
  c.pricing.rhodium = 50;
  const mat = (slug) => c.groups.material.find((m) => m.slug === slug);
  mat('manganovo').price.surcharge_flat = 50;
  mat('belo-pd').price.surcharge_per_gram = 50;
  c.groups.finish.find((f) => f.slug === 'mat').price = { type: 'flat', amount: 80 };   // = Wama "hammered" +80
  // Wama prices the FULL weight (no groove/edge/separation volume, §17)
  const real = a.bandVolumes.bind(a);
  const wamaVols = function (k) { const gs = this.geoOf(this.state[k]); return RG.bandVolumes({ ...gs, grooves: [], edges: { left: { form: 'none' }, right: { form: 'none' } }, separation: { active: false } }); };
  const N = { form: 'none', width: 0.5, depth: 0.1 };
  const rows = [
    ['P1 5×1.5 yellow 585', {}, 5988, 6.5609],
    ['P1 5×1.5 yellow 333', { finoca: '333' }, 3135, 5.3770],
    ['P1 5×1.5 yellow 750', { finoca: '750' }, 8634, 7.6462],
    ['white 585 + rhodium', { bandMetals: ['belo'], rhodium: [true] }, 6111, 6.5609],
    ['manganese 585', { bandMetals: ['manganovo'] }, 5616, 6.0183],
    ['white-pd 585', { bandMetals: ['belo-pd'] }, 7561, 7.3009],
    ['yellow 585 hammered', { finish: 'mat' }, 6185, 6.5609],
    ['P1 8×1.5 hammered', { width: 8, finish: 'mat' }, 9829, 10.5537],
    ['V90 0.2 @2.5', { grooves: [{ form: 'v-groove-90', pos: 2.5, width: 0.2, depth: 0.1 }] }, 5988, 6.5609],
    ['V60 0.5 @2.5', { grooves: [{ form: 'v-groove-60', pos: 2.5, width: 0.5, depth: 0.433 }] }, 6198, 6.5609],
    ['U 1.2×0.6', { grooves: [{ form: 'u-groove', pos: 2.5, width: 1.2, depth: 0.6 }] }, 6198, 6.5609],
    ['333 square 0.3×0.05', { finoca: '333', grooves: [{ form: 'square-groove', pos: 2.5, width: 0.3, depth: 0.05 }] }, 3347, 5.3770],
    ['vertical-1-1 yellow/white', { div: 'vertical-1-1', bandMetals: ['zuto', 'belo'] }, 6424, 6.5609],
    ['wave-1-1 30% 2 yellow/white', { div: 'wave-1-1', bandMetals: ['zuto', 'belo'] }, 6892, 6.5609],
    ['750 vertical-1-1', { finoca: '750', div: 'vertical-1-1', bandMetals: ['zuto', 'belo'] }, 9085, 7.6462],
    ['vertical-1-1 yellow/white-pd', { div: 'vertical-1-1', bandMetals: ['zuto', 'belo-pd'] }, 7235, 3.2805 + 3.6505],
    ['hammered vertical-1-1 yellow/white+Rh', { finish: 'mat', div: 'vertical-1-1', bandMetals: ['zuto', 'belo'], rhodium: [false, true] }, 6743, 6.5609],
    ['P1 6×1.5 1-2-1 Y/Pd/R + edges', { width: 6, div: 'vertical-1-2-1', bandMetals: ['zuto', 'belo-pd', 'crveno'],
      edges: { left: { form: 'normal', width: 0.3, depth: 0.05 }, right: { form: 'perlage', width: 0.445, depth: 0.1 } } }, 8714, 1.9496 + 4.4430 + 1.9496],
    ['P16 6×2 V90+convex+perlage (no stone: Wama 8978 − 70.38 ek)', { profile: 'zaobljeni', width: 6, thickness: 2,
      grooves: [{ form: 'v-groove-90', pos: 1.2, width: 0.5, depth: 0.25 }, { form: 'convex-u-groove', pos: 3.0, width: 1.5, depth: 0.1 }, { form: 'perlage', pos: 4.85, width: 0.9, depth: 0.1 }] },
      Math.round((3649.50 - 70.377) * 2.46), 9.3206],
  ];
  const out = [];
  for (const [name, o, expShown, expMass] of rows) {
    const s = a.state.her = a.defaultState('her');
    Object.assign(s, { profile: 'pljosnati', width: 5, thickness: 1.5, size: 62, finoca: '585', finish: 'polirano' });
    if (o.div) a.setDivision(s, o.div);
    const { div, ...rest } = o;
    Object.assign(s, JSON.parse(JSON.stringify(rest)));
    if (o.bandMetals) s.material = s.bandMetals[0];
    if (!o.rhodium) s.rhodium = s.bandMetals.map(() => false);
    a._volCache = {};
    a.bandVolumes = wamaVols;
    const w = a._ringPrice('her');
    a.bandVolumes = real; a._volCache = {};
    const r = a._ringPrice('her');
    out.push({ name, cls: w.cls, wamaMass: +w.mass.toFixed(4), expMass: +expMass.toFixed(4), shown: Math.round(w.raw * 2.46), expShown, ok: Math.round(w.raw * 2.46) === expShown,
      realMass: +r.mass.toFixed(4), realShown: Math.round(r.raw * 2.46), grooves: s.grooves.length });
  }
  return out;
});
let bad = 0;
for (const r of res) {
  if (!r.ok) bad++;
  console.log(`${r.ok ? 'ok  ' : 'DIFF'} ${r.name.padEnd(58)} ${r.cls.padEnd(7)} mass ${r.wamaMass.toFixed(4)} (Wama ${r.expMass.toFixed(4)})  shown ${r.shown} (Wama ${r.expShown})  | real mass ${r.realMass.toFixed(4)} → ${r.realShown}`);
}
console.log(bad ? bad + ' differ' : 'all match', 'errors', errors);
await browser.close();
