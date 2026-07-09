// Maintenance flows (descale-prep + descaling / cleaning run pages), image-backed
// on the default-skin photographic pages (descale_prepare / descaling / cleaning).
// Faithful to the Tcl default skin's descale_prepare page: title + four numbered
// prep steps + Cancel / "Descale now". Rendered on its own top-level layer so it
// can sit above the Settings overlay it is launched from.
import * as api from '../modules/api.js';
import { PageHost } from '../modules/page.js';
import { t } from '../modules/i18n.js';
import { logger } from '../modules/logger.js';

const IMG = 'assets/insight/';
const FONT = "'InsightUI', Helvetica, Arial, sans-serif";
const RED = '#a77171';
const V = (pages, x, y, o) => ({ kind: 'var', pages, x, y, anchor: o.anchor || 'nw', size: o.size || 34,
  weight: o.weight || 'normal', fill: o.fill || RED, family: FONT, bind: o.bind, width: o.width, wrap: o.wrap });
const B = (pages, rect, action) => ({ kind: 'button', pages, rect, action });

// The four prep steps (text from the default skin's descale_prepare page).
const STEPS = [
  [270, '1) Remove the drip tray and its cover.'],
  [610, '2) In the water tank, mix 1.5 liter hot water with 300g citric acid powder. Let the water cool to room temperature.'],
  [980, '3) Put a blind basket in the portafilter. Lower the steam wand.'],
  [1310, '4) Push back the water tank. Place the drip tray back without its cover.'],
];

const config = {
  imgBase: IMG,
  pages: { descale_prepare: 'descale_prepare.avif', descaling: 'descaling.avif', cleaning: 'cleaning.avif' },
  elements: [
    // ---- descale prep ----
    V(['descale_prepare'], 70, 60, { size: 56, weight: 'bold', bind: () => t('Prepare to descale') }),
    ...STEPS.map(([y, txt]) => V(['descale_prepare'], 70, y, { size: 34, weight: 'bold', width: 1500, wrap: true, bind: () => t(txt) })),
    B(['descale_prepare'], [0, 1200, 700, 1600], 'cancel'),
    B(['descale_prepare'], [1500, 1200, 2560, 1600], 'startDescale'),
    V(['descale_prepare'], 340, 1484, { anchor: 'center', size: 44, weight: 'bold', fill: '#444444', bind: () => t('Cancel') }),
    V(['descale_prepare'], 1920, 1484, { anchor: 'center', size: 44, weight: 'bold', fill: '#444444', bind: () => t('Descale now') }),
    // ---- descaling run page ----
    V(['descaling'], 1280, 90, { anchor: 'center', size: 60, weight: 'bold', fill: '#cccccc', bind: () => t('Descaling') }),
    B(['descaling'], [880, 1310, 1680, 1570], 'stopMaint'),
    V(['descaling'], 1280, 1420, { anchor: 'center', size: 44, weight: 'bold', fill: '#ffffff', bind: () => t('Stop') }),
    // ---- cleaning run page ----
    V(['cleaning'], 1280, 90, { anchor: 'center', size: 60, weight: 'bold', fill: '#eeeeee', bind: () => t('Cleaning') }),
    B(['cleaning'], [880, 1310, 1680, 1570], 'stopMaint'),
    V(['cleaning'], 1280, 1420, { anchor: 'center', size: 44, weight: 'bold', fill: '#ffffff', bind: () => t('Stop') }),
  ],
};

let layer = null, host = null, onDone = null;

function close() {
  if (layer) layer.style.display = 'none';
  const d = onDone; onDone = null; host = null;
  if (d) d();
}

const actions = {
  cancel: () => close(),
  startDescale: () => { api.setMachineState('descaling').catch((e) => logger.warn('descale', e)); host.show('descaling'); },
  stopMaint: () => { api.setMachineState('idle').catch(() => {}); close(); },
};

// kind: 'descale' (shows the prep page first) or 'clean' (goes straight to the
// cleaning run page and starts the cycle). done() runs when the layer closes.
export function openMaintenance(kind, done) {
  onDone = done || null;
  layer = document.getElementById('maint');
  if (!layer) { layer = document.createElement('div'); layer.id = 'maint'; document.getElementById('stage').appendChild(layer); }
  layer.innerHTML = '<div class="s2page"></div>';
  layer.style.display = 'block';
  host = new PageHost(layer, config, actions, layer.querySelector('.s2page'));
  if (kind === 'clean') { host.show('cleaning'); api.setMachineState('cleaning').catch((e) => logger.warn('clean', e)); }
  else host.show('descale_prepare');
}
