// GFC — Graphical Flow Calibrator. Corrects the flow meter so reported volume
// matches the actual weight on the scale. Compares a reported dispense volume to
// the measured weight and applies the correction to the reaprime flow
// multipliers (volume + weight + hot-water) via /settings.
import * as api from '../modules/api.js';
import { openOverlay, closeOverlay } from '../modules/overlay.js';
import { logger } from '../modules/logger.js';

const el = (t, c, x) => { const n = document.createElement(t); if (c) n.className = c; if (x != null) n.textContent = x; return n; };

export async function openGFC() {
  let settings = {};
  try { settings = (await api.getReaSettings()) || {}; } catch (e) { logger.warn('gfc settings', e); }
  const cur = settings.volumeFlowMultiplier ?? 1.0;

  const panel = el('div', 'settings-page');
  panel.innerHTML = `
    <header class="picker-head">
      <button class="back-btn" id="gfc-back">‹ Back</button>
      <h2>Flow meter calibration</h2>
      <button class="save-btn" id="gfc-save">Apply</button>
    </header>
    <div class="settings-body" style="max-width:640px">
      <p style="color:#555;line-height:1.5">Dispense hot water into a vessel on the scale, then enter what
      the machine <b>reported</b> and what the scale <b>actually measured</b>. The flow multiplier is
      corrected so future volumes read true.</p>
      <div class="settings-grid">
        <label class="set-row"><span>Current multiplier</span><b id="gfc-cur">${cur.toFixed(3)}</b></label>
        <label class="set-row"><span>Reported volume (ml)</span><span class="set-num"><input id="gfc-rep" type="number" step="0.1" value="50"></span></label>
        <label class="set-row"><span>Actual weight (g)</span><span class="set-num"><input id="gfc-act" type="number" step="0.1" value="50"></span></label>
        <label class="set-row"><span>New multiplier</span><b id="gfc-new">${cur.toFixed(3)}</b></label>
      </div>
      <div class="dye-status" id="gfc-status"></div>
    </div>`;
  openOverlay(panel);
  const $ = (id) => panel.querySelector(id);
  $('#gfc-back').addEventListener('click', closeOverlay);

  const recompute = () => {
    const rep = parseFloat($('#gfc-rep').value), act = parseFloat($('#gfc-act').value);
    let nm = cur;
    if (rep > 0 && act > 0) nm = cur * (act / rep);
    nm = Math.min(2, Math.max(0.5, nm));
    $('#gfc-new').textContent = nm.toFixed(3);
    return nm;
  };
  $('#gfc-rep').addEventListener('input', recompute);
  $('#gfc-act').addEventListener('input', recompute);

  $('#gfc-save').addEventListener('click', async () => {
    const nm = recompute();
    $('#gfc-status').textContent = 'Applying…';
    try {
      await api.setReaSettings({ volumeFlowMultiplier: nm, weightFlowMultiplier: nm, hotWaterFlowMultiplier: settings.hotWaterFlowMultiplier ?? nm });
      $('#gfc-status').textContent = `Applied. Multiplier ${nm.toFixed(3)}.`;
      setTimeout(closeOverlay, 800);
    } catch (e) { logger.error('gfc save', e); $('#gfc-status').textContent = 'Failed: ' + e.message; }
  });
}
