// Pixel-faithful espresso page config (2560x1600 coords from Insight skin.tcl).
// Consumed by PageHost. Elements: tap-zone buttons, live-text variables (bound
// to the `live` object), and the graph mount. Backgrounds & coordinates come
// straight from the extracted INSIGHT coordinate map.
const IMG = 'assets/insight/';
const F = { data: 44, label: 34, button: 80, sub: 42, prof: 40, step: 30 };
const C = { data: '#42465c', lighter: '#969eb1', dark: '#5a5d75', button: '#2d3046' };

const ALL = ['off', 'espresso', 'espresso_3'];
const OFFISH = ['off', 'espresso_3'];
// The zoomed chart views keep the right-hand card + button, so card rows show
// there too (the 3-panel graph mount stays on ALL only, not these).
const ZCARD = ['off_zoomed', 'espresso_zoomed', 'espresso_3_zoomed', 'off_zoomed_temperature', 'espresso_zoomed_temperature', 'espresso_3_zoomed_temperature'];
const ZOFF = ['off_zoomed', 'espresso_3_zoomed', 'off_zoomed_temperature', 'espresso_3_zoomed_temperature'];
const CARDALL = [...ALL, ...ZCARD];
const CARDOFF = [...OFFISH, ...ZOFF];

const wrap = (s, n, i) => { s = String(s || ''); const words = s.split(' '); const lines = ['', '']; let li = 0;
  for (const w of words) { if ((lines[li] + ' ' + w).trim().length > n && li < 1) li++; lines[li] = (lines[li] + ' ' + w).trim(); }
  return lines[i] || ''; };
const n1 = (v) => (typeof v === 'number' ? v.toFixed(1) : '');
const n0 = (v) => (typeof v === 'number' ? Math.round(v) : '');
const sec = (v) => Math.round(typeof v === 'number' ? v : 0);
const vol = (v) => Math.round(typeof v === 'number' ? v : 0);
// compact var-row builder (Insight card is dozens of small text rows)
const row = (pages, x, y, anchor, fill, bind, o = {}) => ({ kind: 'var', pages, x, y, anchor,
  size: o.size || F.label, weight: o.weight || 'normal', fill, bind });

export const espressoConfig = {
  imgBase: IMG,
  pages: {
    off: 'espresso_3.png', espresso: 'espresso_2.png', espresso_3: 'espresso_3.png',
    off_zoomed: 'espresso_3_zoomed.png', espresso_zoomed: 'espresso_2_zoomed.png', espresso_3_zoomed: 'espresso_3_zoomed.png',
    off_zoomed_temperature: 'espresso_3_zoomed.png', espresso_zoomed_temperature: 'espresso_2_zoomed.png', espresso_3_zoomed_temperature: 'espresso_3_zoomed.png',
  },
  elements: [
    // ---- espresso control (top nav + sleep/settings come from shared.js) ----
    { kind: 'button', pages: OFFISH, rect: [2020, 240, 2560, 700], action: 'startEspresso' },
    { kind: 'button', pages: ['espresso'], rect: [2020, 240, 2560, 1200], action: 'stopEspresso' },
    // ---- chart zoom ----
    { kind: 'button', pages: ALL, rect: [10, 240, 2012, 1135], action: 'zoomPF' },
    { kind: 'button', pages: ALL, rect: [10, 1136, 2012, 1600], action: 'zoomTemp' },
    // ---- card / utility ----
    { kind: 'button', pages: OFFISH, rect: [2040, 1072, 2400, 1180], action: 'profileSelect' },
    { kind: 'button', pages: OFFISH, rect: [2040, 720, 2560, 1070], action: 'editProfile' },
    { kind: 'button', pages: OFFISH, rect: [2420, 1200, 2560, 1400], action: 'describe' },
    { kind: 'button', pages: ['espresso'], rect: [2020, 1204, 2560, 1600], action: 'skipStep' },

    // ---- graph (3 stacked panels) ----
    { kind: 'graph', id: 'espresso_chart', pages: ALL, rect: [20, 267, 2010, 1584] },

    // ---- zoomed views ----
    { kind: 'graph', id: 'zoom_pf', pages: ['off_zoomed', 'espresso_zoomed', 'espresso_3_zoomed'], rect: [20, 78, 2010, 1588] },
    { kind: 'graph', id: 'zoom_temp', pages: ['off_zoomed_temperature', 'espresso_zoomed_temperature', 'espresso_3_zoomed_temperature'], rect: [20, 74, 2010, 1590] },
    { kind: 'button', pages: ['off_zoomed', 'espresso_zoomed', 'espresso_3_zoomed'], rect: [1, 140, 2012, 1588], action: 'unzoom' },
    // resistance checkbox (pf zoom): tap to toggle the puck-resistance curve
    { kind: 'button', pages: ['off_zoomed', 'espresso_zoomed', 'espresso_3_zoomed'], rect: [1080, 15, 1440, 135], action: 'toggleResistance' },
    // temp zoom: tap top half to zoom the Y-scale in, bottom half to zoom out
    { kind: 'button', pages: ['off_zoomed_temperature', 'espresso_zoomed_temperature', 'espresso_3_zoomed_temperature'], rect: [20, 74, 2010, 830], action: 'tempZoomIn' },
    { kind: 'button', pages: ['off_zoomed_temperature', 'espresso_zoomed_temperature', 'espresso_3_zoomed_temperature'], rect: [20, 830, 2010, 1590], action: 'tempZoomOut' },
    { kind: 'button', pages: ['off_zoomed', 'espresso_3_zoomed', 'off_zoomed_temperature', 'espresso_3_zoomed_temperature'], rect: [2020, 240, 2560, 700], action: 'startEspresso' },
    { kind: 'button', pages: ['espresso_zoomed', 'espresso_zoomed_temperature'], rect: [2020, 240, 2560, 1200], action: 'stopEspresso' },
    { kind: 'button', pages: ['off_zoomed', 'espresso_zoomed', 'espresso_3_zoomed', 'off_zoomed_temperature', 'espresso_zoomed_temperature', 'espresso_3_zoomed_temperature'], rect: [2020, 0, 2550, 180], action: 'navSteam' },
    // "STEAM" next-mode hint shown top-right on the zoomed views (icon is baked in)
    row(['off_zoomed', 'espresso_zoomed', 'espresso_3_zoomed', 'off_zoomed_temperature', 'espresso_zoomed_temperature', 'espresso_3_zoomed_temperature'], 2360, 90, 'center', C.lighter, () => 'STEAM', { size: F.sub }),
    { kind: 'var', pages: ['off_zoomed', 'off_zoomed_temperature'], x: 2290, y: 390, anchor: 'center', size: F.button, weight: 'bold', fill: C.button, bind: () => 'START' },
    { kind: 'var', pages: ['espresso_zoomed', 'espresso_zoomed_temperature'], x: 2290, y: 390, anchor: 'center', size: F.button, weight: 'bold', fill: C.button, bind: () => 'STOP' },
    { kind: 'var', pages: ['espresso_3_zoomed', 'espresso_3_zoomed_temperature'], x: 2290, y: 390, anchor: 'center', size: F.button, weight: 'bold', fill: C.button, bind: () => 'RESTART' },

    // ---- big round button (state text + ESPRESSO label + substate line) ----
    row(['off'], 2290, 390, 'center', C.button, () => 'START', { size: F.button, weight: 'bold' }),
    row(['espresso'], 2290, 390, 'center', C.button, () => 'STOP', { size: F.button, weight: 'bold' }),
    row(['espresso_3'], 2290, 390, 'center', C.button, () => 'RESTART', { size: F.button, weight: 'bold' }),
    row(CARDALL, 2295, 462, 'center', C.lighter, () => 'ESPRESSO', { size: F.sub }),
    row(CARDALL, 2295, 520, 'center', C.lighter, (l) => l.substate || 'ready', { size: F.sub }),

    // ---- data card: Time / Volume columns (pos_top 720, spacer 38) ----
    row(CARDALL, 2060, 720, 'nw', C.dark, () => 'Time', { weight: 'bold' }),
    row(CARDALL, 2512, 720, 'ne', C.dark, () => 'Volume', { weight: 'bold' }),
    row(CARDALL, 2060, 758, 'nw', C.lighter, (l) => `${sec(l.preinfElapsed)}s preinfusion`),
    row(CARDALL, 2512, 758, 'ne', C.lighter, (l) => `${vol(l.preinfVolume)} mL`),
    row(CARDALL, 2060, 796, 'nw', C.lighter, (l) => `${sec(l.pourElapsed)}s pouring${l.targetVolume > 0 ? ` < ${vol(l.targetVolume)} mL` : ''}`),
    row(CARDALL, 2512, 796, 'ne', C.lighter, (l) => `${vol(l.pourVolumeOnly)} mL`),
    row(CARDALL, 2060, 834, 'nw', C.lighter, (l) => `${sec(l.elapsed)}s total`),
    row(CARDALL, 2512, 834, 'ne', C.lighter, (l) => `${vol(l.totalVolume)} mL`),
    row(CARDOFF, 2060, 872, 'nw', C.lighter, (l) => `${sec(l.doneElapsed)}s done`),

    // ---- data card: Temperature block ----
    row(CARDALL, 2060, 948, 'nw', C.dark, () => 'Temperature', { weight: 'bold' }),
    row(CARDALL, 2060, 986, 'nw', C.lighter, (l) => `${n1(l.targetTemp)}°C goal`),
    row(['espresso'], 2060, 1024, 'nw', C.lighter, (l) => `${n1(l.coffeeTemp)}°C coffee`),
    row(['espresso'], 2060, 1062, 'nw', C.lighter, (l) => `${n1(l.metalTemp)}°C metal`),
    row(CARDOFF, 2060, 1024, 'nw', C.lighter, (l) => `${n1(l.metalTemp)}°C metal`),

    // ---- data card: Profile type + name ----
    row(CARDALL, 2060, 1080, 'nw', C.dark, (l) => l.profileType || 'Profile', { weight: 'bold' }),
    row(CARDALL, 2060, 1118, 'nw', C.lighter, (l) => wrap(l.profileTitle, 29, 0)),
    row(CARDALL, 2060, 1156, 'nw', C.lighter, (l) => wrap(l.profileTitle, 29, 1)),
  ],
};
