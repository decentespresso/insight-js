// Pixel-faithful espresso page config (2560x1600 coords from Insight skin.tcl).
// Consumed by PageHost. Elements: tap-zone buttons, live-text variables (bound
// to the `live` object), and the graph mount. Backgrounds & coordinates come
// straight from the extracted INSIGHT coordinate map.
const IMG = 'assets/insight/';
const F = { data: 44, label: 34, button: 66, sub: 30, prof: 40, step: 30 };
const C = { data: '#42465c', lighter: '#969eb1', dark: '#5a5d75', button: '#2d3046' };

const ALL = ['off', 'espresso', 'espresso_3'];
const OFFISH = ['off', 'espresso_3'];

const wrap = (s, n, i) => { s = String(s || ''); const words = s.split(' '); const lines = ['', '']; let li = 0;
  for (const w of words) { if ((lines[li] + ' ' + w).trim().length > n && li < 1) li++; lines[li] = (lines[li] + ' ' + w).trim(); }
  return lines[i] || ''; };
const n1 = (v) => (typeof v === 'number' ? v.toFixed(1) : '');
const n0 = (v) => (typeof v === 'number' ? Math.round(v) : '');

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
    { kind: 'button', pages: ['off_zoomed', 'espresso_zoomed', 'espresso_3_zoomed'], rect: [1, 100, 2012, 1135], action: 'unzoom' },
    { kind: 'button', pages: ['off_zoomed_temperature', 'espresso_zoomed_temperature', 'espresso_3_zoomed_temperature'], rect: [1, 1, 2012, 1600], action: 'unzoom' },
    { kind: 'button', pages: ['off_zoomed', 'espresso_3_zoomed', 'off_zoomed_temperature', 'espresso_3_zoomed_temperature'], rect: [2020, 240, 2560, 700], action: 'startEspresso' },
    { kind: 'button', pages: ['espresso_zoomed', 'espresso_zoomed_temperature'], rect: [2020, 240, 2560, 1200], action: 'stopEspresso' },
    { kind: 'button', pages: ['off_zoomed', 'espresso_zoomed', 'espresso_3_zoomed', 'off_zoomed_temperature', 'espresso_zoomed_temperature', 'espresso_3_zoomed_temperature'], rect: [2020, 0, 2550, 180], action: 'navSteam' },
    { kind: 'var', pages: ['off_zoomed', 'off_zoomed_temperature'], x: 2290, y: 390, anchor: 'center', size: F.button, weight: 'bold', fill: C.button, bind: () => 'START' },
    { kind: 'var', pages: ['espresso_zoomed', 'espresso_zoomed_temperature'], x: 2290, y: 390, anchor: 'center', size: F.button, weight: 'bold', fill: C.button, bind: () => 'STOP' },
    { kind: 'var', pages: ['espresso_3_zoomed', 'espresso_3_zoomed_temperature'], x: 2290, y: 390, anchor: 'center', size: F.button, weight: 'bold', fill: C.button, bind: () => 'RESTART' },

    // ---- big button label ----
    { kind: 'var', pages: ['off'], x: 2290, y: 390, anchor: 'center', size: F.button, weight: 'bold', fill: C.button, bind: () => 'START' },
    { kind: 'var', pages: ['espresso'], x: 2290, y: 390, anchor: 'center', size: F.button, weight: 'bold', fill: C.button, bind: () => 'STOP' },
    { kind: 'var', pages: ['espresso_3'], x: 2290, y: 390, anchor: 'center', size: F.button, weight: 'bold', fill: C.button, bind: () => 'RESTART' },
    { kind: 'var', pages: ALL, x: 2295, y: 520, anchor: 'center', size: F.sub, fill: C.lighter, bind: (l) => l.substate || '' },

    // ---- data card: temperature block (upper card) ----
    { kind: 'var', pages: OFFISH, x: 2060, y: 758, anchor: 'nw', size: F.label, fill: C.lighter, bind: () => 'Temperature' },
    { kind: 'var', pages: OFFISH, x: 2060, y: 800, anchor: 'nw', size: F.data, fill: C.data, bind: (l) => `${n1(l.targetTemp)}°C` },
    { kind: 'var', pages: ['espresso'], x: 2060, y: 758, anchor: 'nw', size: F.label, fill: C.lighter, bind: () => 'Temperature' },
    { kind: 'var', pages: ['espresso'], x: 2060, y: 800, anchor: 'nw', size: F.data, fill: C.data, bind: (l) => `${n1(l.mixTemp)}°C` },

    // ---- profile block (lower card) ----
    { kind: 'var', pages: OFFISH, x: 2060, y: 1081, anchor: 'nw', size: F.prof, fill: C.dark, bind: (l) => wrap(l.profileTitle, 22, 0) },
    { kind: 'var', pages: OFFISH, x: 2060, y: 1127, anchor: 'nw', size: F.prof, fill: C.dark, bind: (l) => wrap(l.profileTitle, 22, 1) },

    // ---- espresso live: time / volume / flow / pressure ----
    { kind: 'var', pages: ['espresso'], x: 2060, y: 900, anchor: 'nw', size: F.label, fill: C.lighter, bind: () => 'Time' },
    { kind: 'var', pages: ['espresso'], x: 2512, y: 900, anchor: 'ne', size: F.data, fill: C.data, bind: (l) => n1(l.elapsed) },
    { kind: 'var', pages: ['espresso'], x: 2060, y: 980, anchor: 'nw', size: F.label, fill: C.lighter, bind: () => 'Flow' },
    { kind: 'var', pages: ['espresso'], x: 2512, y: 980, anchor: 'ne', size: F.data, fill: '#6c9bff', bind: (l) => n1(l.flow) },
    { kind: 'var', pages: ['espresso'], x: 2060, y: 1060, anchor: 'nw', size: F.label, fill: C.lighter, bind: () => 'Pressure' },
    { kind: 'var', pages: ['espresso'], x: 2512, y: 1060, anchor: 'ne', size: F.data, fill: '#00b672', bind: (l) => n1(l.pressure) },
    { kind: 'var', pages: ['espresso'], x: 2060, y: 1140, anchor: 'nw', size: F.label, fill: C.lighter, bind: () => 'Weight' },
    { kind: 'var', pages: ['espresso'], x: 2512, y: 1140, anchor: 'ne', size: F.data, fill: C.data, bind: (l) => `${n1(l.weight)}` },
    { kind: 'var', pages: ['espresso'], x: 2060, y: 1290, anchor: 'nw', size: F.step, fill: C.lighter, bind: (l) => l.currentStep || '' },
  ],
};
