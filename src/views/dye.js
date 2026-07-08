// DYE — "Describe Your Espresso": post-shot logging. Captures enjoyment, notes,
// coffee (roaster/name), grinder (model/setting) and dose, and saves them onto
// the latest shot record via the reaprime shots API, plus updates the workflow
// context so the next shot remembers the coffee/grinder.
import * as api from '../modules/api.js';
import { openOverlay, closeOverlay } from '../modules/overlay.js';
import { logger } from '../modules/logger.js';

const el = (t, c, x) => { const n = document.createElement(t); if (c) n.className = c; if (x != null) n.textContent = x; return n; };

export async function openDYE() {
  const panel = el('div', 'dye');
  panel.innerHTML = `
    <header class="picker-head">
      <button class="back-btn" id="dye-back">‹ Back</button>
      <h2>Describe your espresso</h2>
      <button class="save-btn" id="dye-save">Save</button>
    </header>
    <div class="dye-body">
      <div class="dye-field enjoy">
        <label>Enjoyment <b id="dye-enjoy-val">75</b></label>
        <input type="range" id="dye-enjoy" min="0" max="100" step="1" value="75">
      </div>
      <div class="dye-field"><label>Notes</label>
        <textarea id="dye-notes" rows="4" placeholder="How did it taste?"></textarea></div>
      <div class="dye-grid">
        <div class="dye-field"><label>Roaster</label><input id="dye-roaster" type="text"></div>
        <div class="dye-field"><label>Coffee</label><input id="dye-coffee" type="text"></div>
        <div class="dye-field"><label>Grinder</label><input id="dye-grinder" type="text"></div>
        <div class="dye-field"><label>Grind setting</label><input id="dye-grind" type="text"></div>
        <div class="dye-field"><label>Dose (g)</label><input id="dye-dose" type="number" step="0.1"></div>
        <div class="dye-field"><label>Yield (g)</label><input id="dye-yield" type="number" step="0.1"></div>
      </div>
      <div class="dye-status" id="dye-status"></div>
    </div>`;
  openOverlay(panel);
  const $ = (id) => panel.querySelector(id);
  $('#dye-back').addEventListener('click', closeOverlay);
  $('#dye-enjoy').addEventListener('input', (e) => { $('#dye-enjoy-val').textContent = e.target.value; });

  // Prefill from workflow context + latest shot
  let shotId = null;
  try {
    const wf = await api.getWorkflow();
    const c = wf?.context || {};
    $('#dye-roaster').value = c.coffeeRoaster || '';
    $('#dye-coffee').value = c.coffeeName || '';
    $('#dye-grinder').value = c.grinderModel || '';
    $('#dye-grind').value = c.grinderSetting || '';
    if (c.targetDoseWeight) $('#dye-dose').value = c.targetDoseWeight;
    if (c.targetYield) $('#dye-yield').value = c.targetYield;
  } catch (e) { logger.warn('dye wf', e); }
  try {
    const shot = await api.getLatestShot();
    shotId = shot?.id;
    if (shot?.shotNotes) $('#dye-notes').value = shot.shotNotes;
    if (shot?.metadata?.rating != null) { $('#dye-enjoy').value = shot.metadata.rating; $('#dye-enjoy-val').textContent = shot.metadata.rating; }
  } catch (e) { logger.info('no latest shot'); }

  $('#dye-save').addEventListener('click', async () => {
    const notes = $('#dye-notes').value;
    const rating = +$('#dye-enjoy').value;
    const ctx = {
      coffeeRoaster: $('#dye-roaster').value, coffeeName: $('#dye-coffee').value,
      grinderModel: $('#dye-grinder').value, grinderSetting: $('#dye-grind').value,
      targetDoseWeight: parseFloat($('#dye-dose').value) || undefined,
      targetYield: parseFloat($('#dye-yield').value) || undefined,
    };
    $('#dye-status').textContent = 'Saving…';
    try {
      if (shotId) await api.updateShot(shotId, { shotNotes: notes, metadata: { rating } });
      await api.updateWorkflow({ context: ctx });
      $('#dye-status').textContent = 'Saved';
      setTimeout(closeOverlay, 500);
    } catch (e) { logger.error('dye save', e); $('#dye-status').textContent = 'Save failed: ' + e.message; }
  });
}
