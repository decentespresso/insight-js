// Espresso brew screen — classic Insight layout: combined live chart on the
// left, a data card on the right, a big state-driven START/STOP button, and a
// skip-step control. Drives the machine over REST and reflects live WS data.
import * as api from '../modules/api.js';
import { EspressoChart } from '../modules/chart.js';
import { openProfileSelector } from './profile_selector.js';
import { logger } from '../modules/logger.js';

const el = (tag, cls, txt) => { const n = document.createElement(tag); if (cls) n.className = cls; if (txt != null) n.textContent = txt; return n; };
const f = (v, d = 1) => (typeof v === 'number' ? v.toFixed(d) : '—');

export function createEspressoView() {
  let root, chart, running = false, startedAt = null, timer = null;
  let workflow = null, lastState = 'idle';
  const ui = {};

  function mount(container) {
    root = el('div', 'brew-screen espresso');
    root.innerHTML = `
      <div class="brew-main">
        <div class="brew-title"><span class="profile-title" id="es-prof">—</span></div>
        <div class="brew-chart" id="es-chart"></div>
      </div>
      <aside class="data-card">
        <div class="dc-row"><label>Time</label><b id="dc-time">0.0</b><em>s</em></div>
        <div class="dc-row weight"><label>Weight</label><b id="dc-weight">0.0</b><em>g</em>
          <small id="dc-weight-target"></small></div>
        <div class="dc-row"><label>Pressure</label><b id="dc-pressure" class="c-pressure">0.0</b><em>bar</em></div>
        <div class="dc-row"><label>Flow</label><b id="dc-flow" class="c-flow">0.0</b><em>ml/s</em></div>
        <div class="dc-row"><label>Group</label><b id="dc-group" class="c-temp">0.0</b><em>°C</em></div>
        <div class="dc-step" id="dc-step"></div>
      </aside>
      <div class="brew-actions">
        <button class="skip-btn" id="es-skip" hidden>skip step ▸</button>
        <button class="start-btn" id="es-start">Espresso</button>
      </div>`;
    container.appendChild(root);
    ui.prof = root.querySelector('#es-prof');
    ui.time = root.querySelector('#dc-time');
    ui.weight = root.querySelector('#dc-weight');
    ui.weightTarget = root.querySelector('#dc-weight-target');
    ui.pressure = root.querySelector('#dc-pressure');
    ui.flow = root.querySelector('#dc-flow');
    ui.group = root.querySelector('#dc-group');
    ui.step = root.querySelector('#dc-step');
    ui.start = root.querySelector('#es-start');
    ui.skip = root.querySelector('#es-skip');
    chart = new EspressoChart(root.querySelector('#es-chart'));

    ui.start.addEventListener('click', () => running ? stop() : start());
    ui.skip.addEventListener('click', () => api.setMachineState('skipStep').catch((e) => logger.warn('skip', e)));

    ui.prof.classList.add('clickable');
    ui.prof.addEventListener('click', () => openProfileSelector((p) => { ui.prof.textContent = p.title; loadWorkflow(); }));

    loadWorkflow();
  }

  async function loadWorkflow() {
    try {
      workflow = await api.getWorkflow();
      const p = workflow?.profile;
      ui.prof.textContent = p?.title || 'No profile';
      const tw = workflow?.context?.targetYield ?? p?.target_weight;
      ui.weightTarget.textContent = tw ? `/ ${(+tw).toFixed(0)} g` : '';
    } catch (e) { logger.warn('workflow load', e); }
  }

  function start() {
    api.tareScale().catch(() => {}); // start weight at zero, like Insight
    api.setMachineState('espresso').catch((e) => logger.warn('start', e));
  }
  function stop() { api.setMachineState('idle').catch((e) => logger.warn('stop', e)); }

  function setRunning(on) {
    if (on === running) return;
    running = on;
    if (on) {
      chart.clear(); startedAt = Date.now();
      ui.start.textContent = 'Stop'; ui.start.classList.add('stop');
      ui.skip.hidden = false;
      timer = setInterval(() => { ui.time.textContent = ((Date.now() - startedAt) / 1000).toFixed(1); }, 100);
    } else {
      clearInterval(timer); timer = null;
      ui.start.textContent = 'Espresso'; ui.start.classList.remove('stop');
      ui.skip.hidden = true;
    }
  }

  function onSnapshot(d) {
    const st = (d.state && d.state.state) || d.state;
    if (st !== lastState) { lastState = st; if (st === 'espresso') setRunning(true); else if (running) setRunning(false); }
    ui.pressure.textContent = f(d.pressure, 1);
    ui.flow.textContent = f(d.flow, 1);
    ui.group.textContent = f(d.groupTemperature, 1);
    if (d.currentFrameDescription || d.stepName) ui.step.textContent = d.currentFrameDescription || d.stepName;
    if (running) chart.push(d, currentWeight);
  }

  let currentWeight = null;
  function onScale(d) {
    if (typeof d.weight === 'number') { currentWeight = d.weight; ui.weight.textContent = f(d.weight, 1); }
  }

  function onShow() { chart && chart.resize(); loadWorkflow(); }
  function unmount() { clearInterval(timer); root?.remove(); }

  return { mount, onSnapshot, onScale, onShow, unmount };
}
