// Full-screen rotating-image screensaver, faithful to Insight's "saver" page.
// The Tcl skin sleeps the DE1 and shows a random background image from a large
// set, swapping to a new random image on an interval, with an optional moving
// clock (display_time_in_screen_saver). Tap anywhere to wake.
//
// Images are the same set Insight ships (de1plus/saver/2560x1600/*.jpg),
// converted to AVIF in assets/saver/. Two stacked layers give a crossfade
// between images (nicer than Tk's hard swap). Clock/interval are localStorage-
// tunable; defaults mirror Insight exactly: clock off, and the rotation
// interval is the faithful 10 minutes (Tcl screen_saver_change_interval 10) so
// the setting reads accurately when it's exposed to end users.
import { logger } from '../modules/logger.js';

const BASE = 'assets/saver/';
// All Insight saver images except the plain black one (that's the "black saver"
// mode used when rotation is disabled in the Tcl skin).
const IMAGES = [
  'apartment', 'aztec', 'black-steel', 'cafegirls', 'cities', 'cozy-home', 'cups',
  'darkchoices', 'emmyart1', 'floral', 'frenchbreakfast', 'graffiti1', 'graffiti2',
  'graffitiwall', 'green-cup', 'jimshaw', 'lomen', 'minimalism', 'photomanipulation',
  'rainbowdj', 'splashnoir', 'splotch', 'steampunkespresso', 'steampunklatte', 'threewomen',
];

// Faithful Insight default: 10 minutes (Tcl screen_saver_change_interval 10).
const DEFAULT_INTERVAL_SEC = 600;
const intervalMs = () => {
  const v = parseInt(localStorage.getItem('insight_saver_interval_sec'), 10);
  return (v > 0 ? v : DEFAULT_INTERVAL_SEC) * 1000;
};
const clockEnabled = () => localStorage.getItem('insight_saver_clock') === '1';

// Fisher–Yates (browser Math.random is fine here — this is the skin, not a workflow).
function shuffled(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

let el = null, layers = null, showA = true, order = [], idx = 0;
let imgTimer = null, clockTimer = null, lastMinute = null;

function bg(slug) { return `url("${BASE}${slug}.avif")`; }

function nextImage() {
  idx += 1;
  if (idx >= order.length) { order = shuffled(IMAGES); idx = 0; }   // reshuffle each full pass
  const incoming = showA ? layers[1] : layers[0];
  const outgoing = showA ? layers[0] : layers[1];
  incoming.style.backgroundImage = bg(order[idx]);
  incoming.style.opacity = '1';
  outgoing.style.opacity = '0';
  showA = !showA;
}

function tickClock(clock) {
  const now = new Date();
  const hh = now.getHours(), mm = now.getMinutes();
  clock.textContent = `${((hh + 11) % 12) + 1}:${String(mm).padStart(2, '0')} ${hh < 12 ? 'AM' : 'PM'}`;
  // Insight repositions the clock each minute so it never burns into the panel.
  if (mm !== lastMinute) {
    lastMinute = mm;
    clock.style.left = (12 + Math.random() * 60) + '%';
    clock.style.top = (14 + Math.random() * 62) + '%';
  }
}

export function isSaverOpen() { return el != null; }

export function openSaver(onWake) {
  if (el) return;
  el = document.createElement('div');
  el.id = 'saver';

  const a = document.createElement('div'), b = document.createElement('div');
  a.className = b.className = 'saver-layer';
  el.appendChild(a); el.appendChild(b);
  layers = [a, b];

  order = shuffled(IMAGES); idx = 0; showA = true;
  a.style.backgroundImage = bg(order[0]); a.style.opacity = '1'; b.style.opacity = '0';

  const clock = document.createElement('div');
  clock.className = 'saver-clock';
  if (clockEnabled()) { clock.style.display = 'block'; lastMinute = null; tickClock(clock); clockTimer = setInterval(() => tickClock(clock), 1000); }
  el.appendChild(clock);

  el.addEventListener('click', () => { closeSaver(); if (onWake) onWake(); });
  document.getElementById('stage').appendChild(el);

  imgTimer = setInterval(nextImage, intervalMs());
  logger.info(`saver open (${IMAGES.length} images, ${intervalMs() / 1000}s, clock ${clockEnabled() ? 'on' : 'off'})`);
}

export function closeSaver() {
  if (!el) return;
  clearInterval(imgTimer); clearInterval(clockTimer);
  imgTimer = clockTimer = null;
  el.remove(); el = null; layers = null;
  logger.info('saver closed');
}
