// Shared chrome present on every page: the top mode-nav bar and the bottom
// sleep/settings buttons. pages:['*'] => shown on all pages. The zoomed chart
// views replace the whole top bar with a full-height chart, so the tab nav +
// labels are suppressed there (notPages).
import { t } from '../modules/i18n.js';
const TAB_OFF = '#969eb1', TAB_ON = '#42465c';
// espresso chart-zoom pages: the top tab bar is not shown on these.
const ZOOMED = ['off_zoomed', 'espresso_zoomed', 'espresso_3_zoomed',
  'off_zoomed_temperature', 'espresso_zoomed_temperature', 'espresso_3_zoomed_temperature'];
// `key` is an i18n key; the label re-evaluates t(key) on every host.update, so a
// language change (which re-renders the page) relabels the tabs live.
const tab = (fam, key, x) => ({ kind: 'var', pages: ['*'], notPages: ZOOMED, x, y: 96, anchor: 'center',
  size: 46, weight: 'bold', family: "'InsightUI', Helvetica, Arial, sans-serif",
  bind: () => t(key).toUpperCase(), fillBind: (l) => (l.family === fam ? TAB_ON : TAB_OFF) });

export const sharedElements = [
  { kind: 'button', pages: ['*'], notPages: ZOOMED, rect: [0, 0, 641, 188], action: 'navFlush' },
  { kind: 'button', pages: ['*'], notPages: ZOOMED, rect: [642, 0, 1277, 188], action: 'navEspresso' },
  { kind: 'button', pages: ['*'], notPages: ZOOMED, rect: [1278, 0, 1904, 188], action: 'navSteam' },
  { kind: 'button', pages: ['*'], notPages: ZOOMED, rect: [1905, 0, 2560, 188], action: 'navWater' },
  // tab text labels (icons are baked into the background; labels are overlays).
  // Keys match the de1app translation CSV; uppercased to match the Insight design.
  tab('flush', 'Flush', 380),
  tab('espresso', 'Espresso', 1050),
  tab('steam', 'Steam', 1650),
  tab('water', 'Water', 2280),
  { kind: 'button', pages: ['*'], rect: [2014, 1420, 2284, 1600], action: 'sleep' },
  { kind: 'button', pages: ['*'], rect: [2285, 1420, 2560, 1600], action: 'settings' },
];
