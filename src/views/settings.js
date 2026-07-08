// Settings — machine + app settings. Machine values are read from / written to
// the reaprime machine settings API; app values (units, theme) are local.
import * as api from '../modules/api.js';
import { openOverlay, closeOverlay } from '../modules/overlay.js';
import { openGFC } from './gfc.js';
import { logger } from '../modules/logger.js';

const el = (t, c, x) => { const n = document.createElement(t); if (c) n.className = c; if (x != null) n.textContent = x; return n; };

const NUM = [
  { key: 'targetGroupTemp', label: 'Group temperature', unit: '°C', min: 80, max: 100, step: 0.5 },
  { key: 'tankTemp', label: 'Tank / preheat temp', unit: '°C', min: 0, max: 60, step: 1 },
  { key: 'fan', label: 'Fan threshold', unit: '°C', min: 30, max: 60, step: 1 },
  { key: 'flushTemp', label: 'Flush temperature', unit: '°C', min: 60, max: 95, step: 1 },
  { key: 'hotWaterFlow', label: 'Hot water flow', unit: 'ml/s', min: 1, max: 10, step: 0.1 },
  { key: 'steamFlow', label: 'Steam flow', unit: 'ml/s', min: 0.5, max: 3, step: 0.1 },
];

export async function openSettings() {
  const panel = el('div', 'settings-page');
  panel.innerHTML = `
    <header class="picker-head">
      <button class="back-btn" id="set-back">‹ Back</button>
      <h2>Settings</h2>
      <button class="save-btn" id="set-save">Save</button>
    </header>
    <div class="settings-body">
      <h3>Machine</h3>
      <div class="settings-grid" id="set-machine"></div>
      <h3>App</h3>
      <div class="settings-grid">
        <label class="set-row"><span>Temperature units</span>
          <select id="set-units"><option value="c">Celsius</option><option value="f">Fahrenheit</option></select></label>
        <label class="set-row"><span>Theme</span>
          <select id="set-theme"><option value="light">Insight (light)</option><option value="dark">Insight Dark</option></select></label>
        <div class="set-row"><span>Flow meter calibration</span>
          <button class="save-btn" id="set-gfc" style="background:#4e85f4">Calibrate →</button></div>
      </div>
      <div class="dye-status" id="set-status"></div>
    </div>`;
  openOverlay(panel);
  const $ = (id) => panel.querySelector(id);
  $('#set-back').addEventListener('click', closeOverlay);
  $('#set-gfc').addEventListener('click', () => openGFC());

  const grid = $('#set-machine');
  let machine = {};
  try { machine = (await api.getMachineSettings()) || {}; } catch (e) { logger.warn('machine settings', e); }
  for (const f of NUM) {
    const row = el('label', 'set-row');
    row.innerHTML = `<span>${f.label}</span><span class="set-num"><input type="number" data-key="${f.key}" min="${f.min}" max="${f.max}" step="${f.step}" value="${machine[f.key] ?? ''}"><em>${f.unit}</em></span>`;
    grid.appendChild(row);
  }
  $('#set-units').value = localStorage.getItem('units') || 'c';
  $('#set-theme').value = localStorage.getItem('theme') || 'light';

  $('#set-save').addEventListener('click', async () => {
    const body = {};
    grid.querySelectorAll('input[data-key]').forEach((inp) => {
      const v = parseFloat(inp.value); if (!Number.isNaN(v)) body[inp.dataset.key] = v;
    });
    localStorage.setItem('units', $('#set-units').value);
    localStorage.setItem('theme', $('#set-theme').value);
    document.documentElement.dataset.theme = $('#set-theme').value;
    $('#set-status').textContent = 'Saving…';
    try {
      await api.setMachineSettings(body);
      $('#set-status').textContent = 'Saved';
      setTimeout(closeOverlay, 500);
    } catch (e) { logger.error('save settings', e); $('#set-status').textContent = 'Save failed: ' + e.message; }
  });
}
