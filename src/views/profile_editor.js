// Profile editor — edits the loaded profile's steps (the reaprime v2 steps[]
// model, which is what the Insight pressure/flow/advanced editors all write to).
// Each step: name, pump (pressure|flow), target value, temperature, seconds.
// Save applies to the workflow and persists a new profile record.
import * as api from '../modules/api.js';
import { openOverlay, closeOverlay } from '../modules/overlay.js';
import { logger } from '../modules/logger.js';
import { t } from '../modules/i18n.js';

const el = (tag, c, x) => { const n = document.createElement(tag); if (c) n.className = c; if (x != null) n.textContent = x; return n; };
const num = (v) => (v == null ? '' : v);

export async function openProfileEditor(onSaved) {
  let profile;
  try { profile = (await api.getWorkflow())?.profile; } catch (e) { logger.warn('editor wf', e); }
  if (!profile) { alert('No profile loaded'); return; }
  profile = structuredClone(profile);

  const panel = el('div', 'settings-page');
  panel.innerHTML = `
    <header class="picker-head">
      <button class="back-btn" id="pe-back">‹ ${t('Back')}</button>
      <input class="pe-title" id="pe-title" value="${(profile.title || '').replace(/"/g, '&quot;')}">
      <button class="save-btn" id="pe-save">${t('Save')}</button>
    </header>
    <div class="settings-body pe-body">
      <div class="pe-steps" id="pe-steps"></div>
      <button class="pe-add" id="pe-add">+ ${t('Add step')}</button>
      <div class="dye-status" id="pe-status"></div>
    </div>`;
  openOverlay(panel);
  const $ = (id) => panel.querySelector(id);
  $('#pe-back').addEventListener('click', closeOverlay);
  const stepsEl = $('#pe-steps');

  function draw() {
    stepsEl.innerHTML = '';
    (profile.steps || []).forEach((s, i) => {
      const isFlow = s.pump === 'flow';
      const row = el('div', 'pe-step');
      row.innerHTML = `
        <div class="pe-step-hd"><span class="pe-idx">${i + 1}</span>
          <input class="pe-name" data-i="${i}" data-k="name" value="${(s.name || '').replace(/"/g, '&quot;')}">
          <button class="pe-del" data-i="${i}">✕</button></div>
        <div class="pe-step-grid">
          <label>${t('Pump')}<select data-i="${i}" data-k="pump">
            <option value="pressure"${!isFlow ? ' selected' : ''}>${t('pressure')}</option>
            <option value="flow"${isFlow ? ' selected' : ''}>${t('flow')}</option></select></label>
          <label>${isFlow ? t('Flow (ml/s)') : t('Pressure (bar)')}<input type="number" step="0.1" data-i="${i}" data-k="${isFlow ? 'flow' : 'pressure'}" value="${num(isFlow ? s.flow : s.pressure)}"></label>
          <label>${t('Temp (°C)')}<input type="number" step="0.5" data-i="${i}" data-k="temperature" value="${num(s.temperature)}"></label>
          <label>${t('Seconds')}<input type="number" step="0.5" data-i="${i}" data-k="seconds" value="${num(s.seconds)}"></label>
        </div>`;
      stepsEl.appendChild(row);
    });
    stepsEl.querySelectorAll('[data-i]').forEach((inp) => {
      inp.addEventListener('change', () => {
        const i = +inp.dataset.i, k = inp.dataset.k;
        let v = inp.value;
        if (['pressure', 'flow', 'temperature', 'seconds'].includes(k)) v = parseFloat(v);
        profile.steps[i][k] = v;
        if (k === 'pump') draw(); // relabel value field
      });
    });
    stepsEl.querySelectorAll('.pe-del').forEach((b) => b.addEventListener('click', () => { profile.steps.splice(+b.dataset.i, 1); draw(); }));
  }
  draw();

  $('#pe-add').addEventListener('click', () => {
    const last = profile.steps[profile.steps.length - 1] || {};
    profile.steps.push({ name: 'step', pump: 'pressure', pressure: 6, temperature: last.temperature || 90, seconds: 10, transition: 'smooth', sensor: 'coffee' });
    draw();
  });

  $('#pe-save').addEventListener('click', async () => {
    profile.title = $('#pe-title').value || profile.title;
    $('#pe-status').textContent = 'Saving…';
    try {
      await api.updateWorkflow({ profile });   // apply to current workflow (sanitized in api)
      try { await api.saveProfile(profile); } catch (e) { logger.warn('persist profile', e); }
      $('#pe-status').textContent = 'Saved';
      onSaved && onSaved(profile);
      setTimeout(closeOverlay, 500);
    } catch (e) { logger.error('save profile', e); $('#pe-status').textContent = 'Save failed: ' + e.message; }
  });
}
