// Pixel-faithful espresso page config (2560x1600 coords from Insight skin.tcl).
// Consumed by PageHost. Elements: tap-zone buttons, live-text variables (bound
// to the `live` object), and the graph mount. Backgrounds & coordinates come
// straight from the extracted INSIGHT coordinate map.
import { t } from '../modules/i18n.js';
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
// Running (espresso-in-progress) pages — their data card is richer (live Flow +
// Current step + [skip]) than the ready/done card, matching the Tcl Insight card.
const ERUN = ['espresso', 'espresso_zoomed', 'espresso_zoomed_temperature'];
// Card geometry from the Tcl (skin.tcl): pos_top 720, spacer 38, col1 2060, col3 2512.
const PT = 720, SP = 38, cy = (m) => PT + m * SP;

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
    { kind: 'button', pages: ERUN, rect: [2020, 1204, 2560, 1600], action: 'skipStep' },

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
    row(['off_zoomed', 'espresso_zoomed', 'espresso_3_zoomed', 'off_zoomed_temperature', 'espresso_zoomed_temperature', 'espresso_3_zoomed_temperature'], 2360, 90, 'center', C.lighter, () => t('Steam').toUpperCase(), { size: F.sub }),
    { kind: 'var', pages: ['off_zoomed', 'off_zoomed_temperature'], x: 2290, y: 390, anchor: 'center', size: F.button, weight: 'bold', fill: C.button, bind: () => t('START') },
    { kind: 'var', pages: ['espresso_zoomed', 'espresso_zoomed_temperature'], x: 2290, y: 390, anchor: 'center', size: F.button, weight: 'bold', fill: C.button, bind: () => t('STOP') },
    { kind: 'var', pages: ['espresso_3_zoomed', 'espresso_3_zoomed_temperature'], x: 2290, y: 390, anchor: 'center', size: F.button, weight: 'bold', fill: C.button, bind: () => t('RESTART') },

    // ---- big round button (state text + ESPRESSO label + substate line) ----
    row(['off'], 2290, 390, 'center', C.button, () => t('START'), { size: F.button, weight: 'bold' }),
    row(['espresso'], 2290, 390, 'center', C.button, () => t('STOP'), { size: F.button, weight: 'bold' }),
    row(['espresso_3'], 2290, 390, 'center', C.button, () => t('RESTART'), { size: F.button, weight: 'bold' }),
    row(CARDALL, 2295, 462, 'center', C.lighter, () => t('Espresso').toUpperCase(), { size: F.sub }),
    row(CARDALL, 2295, 520, 'center', C.lighter, (l) => l.substate || t('ready'), { size: F.sub }),

    // ---- data card: Time / Volume columns (shared, pos_top 720, spacer 38) ----
    row(CARDALL, 2060, cy(0), 'nw', C.dark, () => t('Time'), { weight: 'bold' }),
    row(CARDALL, 2512, cy(0), 'ne', C.dark, () => t('Volume'), { weight: 'bold' }),
    row(CARDALL, 2060, cy(1), 'nw', C.lighter, (l) => `${sec(l.preinfElapsed)}s ${t('preinfusion')}`),
    row(CARDALL, 2512, cy(1), 'ne', C.lighter, (l) => `${vol(l.preinfVolume)} mL`),
    row(CARDALL, 2060, cy(2), 'nw', C.lighter, (l) => `${sec(l.pourElapsed)}s ${t('pouring')}${l.targetVolume > 0 ? ` < ${vol(l.targetVolume)} mL` : ''}`),
    row(CARDALL, 2512, cy(2), 'ne', C.lighter, (l) => `${vol(l.pourVolumeOnly)} mL`),
    row(CARDALL, 2060, cy(3), 'nw', C.lighter, (l) => `${sec(l.elapsed)}s ${t('total')}`),
    row(CARDALL, 2512, cy(3), 'ne', C.lighter, (l) => `${vol(l.totalVolume)} mL`),
    row(CARDOFF, 2060, cy(4), 'nw', C.lighter, (l) => `${sec(l.doneElapsed)}s ${t('done')}`),

    // ---- READY / DONE card (off / espresso_3): Temperature goal/metal + profile ----
    row(CARDOFF, 2060, 948, 'nw', C.dark, () => t('Temperature'), { weight: 'bold' }),
    row(CARDOFF, 2060, 986, 'nw', C.lighter, (l) => `${n1(l.targetTemp)}°C ${t('goal')}`),
    row(CARDOFF, 2060, 1024, 'nw', C.lighter, (l) => `${n1(l.metalTemp)}°C ${t('metal')}`),
    row(CARDOFF, 2060, 1080, 'nw', C.dark, (l) => t(l.profileType || 'Profile'), { weight: 'bold' }),
    row(CARDOFF, 2060, 1118, 'nw', C.lighter, (l) => wrap(l.profileTitle, 29, 0)),
    row(CARDOFF, 2060, 1156, 'nw', C.lighter, (l) => wrap(l.profileTitle, 29, 1)),

    // ---- RUNNING card (espresso): Temperature goal/coffee + Flow + profile + Current step ----
    row(ERUN, 2060, cy(4.5), 'nw', C.dark, () => t('Temperature'), { weight: 'bold' }),
    row(ERUN, 2060, cy(5.5), 'nw', C.lighter, (l) => `${n1(l.targetTemp)}°C ${t('goal')}`),
    row(ERUN, 2060, cy(6.5), 'nw', C.lighter, (l) => `${n1(l.coffeeTemp)}°C ${t('coffee')}`),
    row(ERUN, 2060, cy(8), 'nw', C.dark, () => t('Flow'), { weight: 'bold' }),
    row(ERUN, 2060, cy(9), 'nw', C.lighter, (l) => `${n1(l.flow)} mL/s`),
    row(ERUN, 2060, cy(10), 'nw', C.lighter, (l) => `${n1(l.pressure)} bar`),
    row(ERUN, 2060, cy(11.5), 'nw', C.dark, (l) => t(l.profileType || 'Profile'), { weight: 'bold' }),
    row(ERUN, 2060, cy(12.5), 'nw', C.lighter, (l) => wrap(l.profileTitle, 29, 0)),
    row(ERUN, 2060, cy(13.5), 'nw', C.lighter, (l) => wrap(l.profileTitle, 29, 1)),
    row(ERUN, 2060, cy(15), 'nw', C.dark, () => t('Current step'), { weight: 'bold' }),
    row(ERUN, 2060, cy(16), 'nw', '#8297be', (l) => l.currentStep || ''),
    row(ERUN, 2512, cy(16), 'ne', '#8297be', () => `[${t('skip')}]`),
  ],
};
