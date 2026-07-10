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

// The four prep steps (text from the default skin's descale_prepare page). Tcl
// positions each in the middle column (x=1050, width 800) so it sits beside the
// item photo on the right, aligned to the photo's row (y 280/670/970/1350).
const STEPS = [
  [280, '1) Remove the drip tray and its cover.'],
  [650, '2) In the water tank, mix 1.5 liter hot water with 300g citric acid powder. Let the water cool to room temperature.'],
  [970, '3) Put a blind basket in the portafilter. Lower the steam wand.'],
  [1350, '4) Push back the water tank. Place the drip tray back without its cover.'],
];

const config = {
  imgBase: IMG,
  pages: { descale_prepare: 'descale_prepare.avif', descaling: 'descaling.avif', cleaning: 'cleaning.avif',
    travel_prepare: 'travel_prepare.avif', travel_do: 'travel_do.avif' },
  elements: [
    // ---- descale prep ----
    V(['descale_prepare'], 70, 50, { size: 73, weight: 'bold', bind: () => t('Prepare to descale') }),
    ...STEPS.map(([y, txt]) => V(['descale_prepare'], 1050, y, { size: 44, weight: 'bold', width: 800, wrap: true, bind: () => t(txt) })),
    B(['descale_prepare'], [0, 1200, 700, 1600], 'cancel'),
    B(['descale_prepare'], [1860, 1200, 2560, 1600], 'startDescale'),
    V(['descale_prepare'], 340, 1504, { anchor: 'center', size: 57, weight: 'bold', fill: '#444444', bind: () => t('Cancel') }),
    V(['descale_prepare'], 2233, 1504, { anchor: 'center', size: 57, weight: 'bold', fill: '#444444', bind: () => t('Descale now') }),
    // ---- descaling run page ----
    V(['descaling'], 1280, 90, { anchor: 'center', size: 60, weight: 'bold', fill: '#cccccc', bind: () => t('Descaling') }),
    B(['descaling'], [880, 1310, 1680, 1570], 'stopMaint'),
    V(['descaling'], 1280, 1420, { anchor: 'center', size: 44, weight: 'bold', fill: '#ffffff', bind: () => t('Stop') }),
    // ---- cleaning run page ----
    V(['cleaning'], 1280, 90, { anchor: 'center', size: 60, weight: 'bold', fill: '#eeeeee', bind: () => t('Cleaning') }),
    B(['cleaning'], [880, 1310, 1680, 1570], 'stopMaint'),
    V(['cleaning'], 1280, 1420, { anchor: 'center', size: 44, weight: 'bold', fill: '#ffffff', bind: () => t('Stop') }),
    // ---- travel: prepare (Tcl travel_prepare) — photo of the pulled-forward tank + Cancel / Ok ----
    V(['travel_prepare'], 1280, 120, { anchor: 'center', size: 44, weight: 'bold', width: 2000, wrap: true, bind: () => t('Prepare your espresso machine for transport') }),
    V(['travel_prepare'], 1520, 1000, { size: 34, weight: 'bold', width: 1000, wrap: true, bind: () => t('After you press Ok, pull the water tank forward as shown in this photograph.') }),
    B(['travel_prepare'], [0, 1200, 600, 1600], 'travelCancel'),
    B(['travel_prepare'], [1960, 1200, 2560, 1600], 'travelPurge'),
    V(['travel_prepare'], 280, 1504, { anchor: 'center', size: 44, weight: 'bold', fill: '#ffffff', bind: () => t('Cancel') }),
    V(['travel_prepare'], 2300, 1504, { anchor: 'center', size: 44, weight: 'bold', fill: '#ffffff', bind: () => t('Ok') }),
    // ---- travel: purging (Tcl travel_do) — whole page taps to wake once out of water ----
    V(['travel_do'], 1280, 120, { anchor: 'center', size: 44, weight: 'bold', width: 2000, wrap: true, bind: () => t('Now removing water from your espresso machine.') }),
    V(['travel_do'], 1520, 1000, { size: 34, weight: 'bold', width: 1000, wrap: true, bind: () => t('You can turn your machine off once it is out of water. It will then be ready for transport.') }),
    B(['travel_do'], [0, 0, 2560, 1600], 'travelWake'),
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
  // ---- travel / transport ----
  travelCancel: () => {
    // API: de1_send_shot_frames() — cancel the "cool" step queued when Transport
    // opened, restoring the normal profile. No reaprime endpoint yet; call here.
    close();
  },
  travelPurge: () => {
    // API: start_air_purge() — begin pumping the water out of the machine so it
    // can be moved without leaking. reaprime exposes no air-purge command yet.
    host.show('travel_do');
  },
  travelWake: () => {
    api.setMachineState('idle').catch(() => {});   // wake the machine (Tcl start_idle)
    // API: de1_send_waterlevel_settings() — restore normal water-level behavior.
    close();
  },
};

// kind: 'descale' (prep page first), 'clean' (straight to the cleaning run page
// and starts the cycle), or 'transport' (travel prep -> purge). done() runs when
// the layer closes.
export function openMaintenance(kind, done) {
  onDone = done || null;
  layer = document.getElementById('maint');
  if (!layer) { layer = document.createElement('div'); layer.id = 'maint'; document.getElementById('stage').appendChild(layer); }
  layer.innerHTML = '<div class="s2page"></div>';
  layer.style.display = 'block';
  host = new PageHost(layer, config, actions, layer.querySelector('.s2page'));
  if (kind === 'clean') { host.show('cleaning'); api.setMachineState('cleaning').catch((e) => logger.warn('clean', e)); }
  else if (kind === 'transport') {
    // API: de1_send_shot_frames("cool") — queue a cooling step before the purge.
    // reaprime exposes no shot-frame endpoint yet; call it here when available.
    host.show('travel_prepare');
  } else host.show('descale_prepare');
}
