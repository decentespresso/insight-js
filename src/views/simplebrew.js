// Generic brew screen for Steam / Water / Flush — the simpler Insight modes:
// a row of editable target tiles (− value +), a live readout row with a timer,
// and a state-driven START/STOP button. Configured per-mode (see steam/water/
// flush.js). Targets are read from and written to the gateway workflow.
import * as api from '../modules/api.js';
import { logger } from '../modules/logger.js';

const f = (v, d = 1) => (typeof v === 'number' ? v.toFixed(d) : '—');

export function createSimpleBrew(cfg) {
  return function () {
    let root, running = false, startedAt = null, timer = null, lastState = 'idle';
    let workflow = null, weight = null;
    const tiles = [], liveEls = [];

    function mount(container) {
      root = document.createElement('div');
      root.className = `brew-screen simple ${cfg.cls}`;
      const targets = cfg.targets.map((t, i) => `
        <div class="target-tile" data-i="${i}">
          <label>${t.label}</label>
          <div class="stepper">
            <button class="dn">−</button>
            <b class="val">—</b><em>${t.unit || ''}</em>
            <button class="up">+</button>
          </div>
        </div>`).join('');
      const live = cfg.live.map((l, i) => `
        <div class="live-tile" data-i="${i}"><label>${l.label}</label>
          <b class="lval">—</b><em>${l.unit || ''}</em></div>`).join('');
      root.innerHTML = `
        <div class="brew-title">${cfg.title}</div>
        <div class="targets-row">${targets}</div>
        <div class="live-row">
          <div class="live-tile timer"><label>${cfg.timerLabel || 'Time'}</label><b id="sb-time">0.0</b><em>s</em></div>
          ${live}
        </div>
        <div class="brew-actions">
          <button class="start-btn" id="sb-start">${cfg.title}</button>
        </div>`;
      container.appendChild(root);

      root.querySelectorAll('.target-tile').forEach((tile) => {
        const i = +tile.dataset.i;
        tiles[i] = { el: tile, val: tile.querySelector('.val'), value: 0 };
        tile.querySelector('.up').addEventListener('click', () => bump(i, +1));
        tile.querySelector('.dn').addEventListener('click', () => bump(i, -1));
      });
      root.querySelectorAll('.live-tile:not(.timer)').forEach((t) => { liveEls[+t.dataset.i] = t.querySelector('.lval'); });
      ui_time = root.querySelector('#sb-time');
      ui_start = root.querySelector('#sb-start');
      ui_start.addEventListener('click', () => (running ? stop() : start()));
      loadTargets();
    }

    let ui_time, ui_start, saveTimer = null;

    async function loadTargets() {
      try {
        workflow = await api.getWorkflow();
        cfg.targets.forEach((t, i) => { tiles[i].value = t.get(workflow) ?? t.min; renderTile(i); });
      } catch (e) { logger.warn('loadTargets', e); }
    }
    function renderTile(i) { tiles[i].val.textContent = cfg.targets[i].fmt ? cfg.targets[i].fmt(tiles[i].value) : tiles[i].value; }

    function bump(i, dir) {
      const t = cfg.targets[i];
      let v = Math.round((tiles[i].value + dir * t.step) / t.step) * t.step;
      v = Math.min(t.max, Math.max(t.min, v));
      tiles[i].value = v; renderTile(i);
      clearTimeout(saveTimer);
      saveTimer = setTimeout(() => api.updateWorkflow(t.set(v)).catch((e) => logger.warn('save target', e)), 350);
    }

    function start() {
      if (cfg.tare) api.tareScale().catch(() => {});
      api.setMachineState(cfg.state).catch((e) => logger.warn('start', e));
    }
    function stop() { api.setMachineState('idle').catch((e) => logger.warn('stop', e)); }

    function setRunning(on) {
      if (on === running) return;
      running = on;
      if (on) {
        startedAt = Date.now();
        ui_start.textContent = 'Stop'; ui_start.classList.add('stop');
        timer = setInterval(() => { ui_time.textContent = ((Date.now() - startedAt) / 1000).toFixed(1); }, 100);
      } else {
        clearInterval(timer); timer = null;
        ui_start.textContent = cfg.title; ui_start.classList.remove('stop');
      }
    }

    function onSnapshot(d) {
      const st = (d.state && d.state.state) || d.state;
      if (st !== lastState) { lastState = st; if (st === cfg.state) setRunning(true); else if (running) setRunning(false); }
      const elapsed = startedAt ? (Date.now() - startedAt) / 1000 : 0;
      cfg.live.forEach((l, i) => { if (liveEls[i]) liveEls[i].textContent = f(l.get(d, weight, elapsed), l.d ?? 1); });
    }
    function onScale(d) { if (typeof d.weight === 'number') weight = d.weight; }
    function onShow() { loadTargets(); }
    function unmount() { clearInterval(timer); clearTimeout(saveTimer); root?.remove(); }

    return { mount, onSnapshot, onScale, onShow, unmount };
  };
}
