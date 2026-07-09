// Insight skin bootstrap (faithful, multi-family + zoom). Drives PageHost across
// espresso/steam/water/flush, renders charts from a shared shot buffer (so the
// zoomed view shows full history), and maps machine state -> page.
import * as api from './api.js';
import { logger, setDebug } from './logger.js';
import { PageHost, curTheme } from './page.js';
import { EspressoChart, ZoomChart, MiniChart } from './chart.js';
import { config, families, stateToFamily } from '../config/index.js';
import { openProfileSelector } from '../views/profile_selector.js';
import { openDYE } from '../views/dye.js';
import { openSettings, isSettingsOpen, settingsGoto, closeSettings, settingsShowChooser, settingsEditProfile, settingsLastTab } from '../views/settings.js';
import { openProfileEditor } from '../views/profile_editor.js';
import { openNumpad } from '../views/numpad.js';
import { openSaver, closeSaver, isSaverOpen } from '../views/saver.js';
import { initI18n } from './i18n.js';

setDebug(true);

const stage = document.getElementById('stage');
const live = { pageState: 'off', family: 'espresso', substate: '', pressure: 0, flow: 0, mixTemp: 0, groupTemp: 0,
  steamTemp: 0, targetTemp: 0, coffeeTemp: 0, metalTemp: 0, weight: 0, elapsed: 0, pourVolume: 0,
  preinfElapsed: 0, pourElapsed: 0, doneElapsed: 0, preinfVolume: 0, pourVolumeOnly: 0, totalVolume: 0,
  profileTitle: '', profileType: 'Profile', targetVolume: 0, targetWeight: 0, currentStep: '',
  steamDuration: 30, waterVolume: 50, waterTemp: 90, flushSeconds: 10,
  waterFlowMax: 10, flushFlowMax: 6, steamTarget: 150, steamFlowMax: 2.5, steamPreheat: 160,
  steamEnabled: true, resistanceOn: false };

// shared shot data buffer (all charts render from it)
const buf = { t: [], p: [], pg: [], f: [], fg: [], w: [], T: [], Tg: [], r: [] };
const resetBuf = () => { for (const k in buf) buf[k] = []; };
// steam/water run buffer for the running-page mini graphs
const runBuf = { t: [], temp: [], w: [] };
const resetRunBuf = () => { runBuf.t = []; runBuf.temp = []; runBuf.w = []; };
let runStart = null;

// profile preview curve (target pressure/flow/temp step lines from profile steps)
let preview = { t: [], p: [], f: [], T: [] };
let currentSteps = [];                          // loaded profile steps (for the "Current step" label)
// pour-phase tracking (preinfusion vs pouring split, like Insight)
let poured = false, preinfEnd = 0, lastVolT = null, doneStart = null, doneTimer = null;

// Determine profile type text (Insight: Pressure / Flow / Advanced profile).
function profileTypeText(steps) {
  if (!Array.isArray(steps) || !steps.length) return 'Profile';
  const pumps = new Set(steps.map((s) => s.pump));
  const hasExit = steps.some((s) => s.exit) || steps.some((s) => s.limiter);
  if (pumps.size > 1 || hasExit) return 'Advanced profile';
  if (pumps.has('flow')) return 'Flow profile';
  return 'Pressure profile';
}

// Build the target-curve preview: pressure line where pressure-controlled, flow
// line where flow-controlled (nulls break the line), temperature throughout.
function buildPreview(steps) {
  const out = { t: [], p: [], f: [], T: [] };
  if (!Array.isArray(steps)) return out;
  // drawable frames (dur>0); zero-duration frames just seed the setpoint
  const draw = []; let sp = null, sf = null;
  for (const s of steps) {
    const dur = Math.max(0, +s.seconds || 0);
    if (dur === 0) { if (s.pump === 'pressure') sp = +s.pressure; else sf = +s.flow; continue; }
    draw.push({ s, dur });
  }
  let clock = 0, prevP = sp, prevF = sf;
  for (let i = 0; i < draw.length; i++) {
    const { s, dur } = draw[i], prev = draw[i - 1], next = draw[i + 1];
    const smooth = s.transition === 'smooth', temp = +s.temperature;
    // A pump handoff (pressure<->flow); the incoming line should rise from 0 at
    // the handoff, like Insight (the outgoing line separately drops to 0 below).
    const handoffIn = prev && prev.s.pump !== s.pump;
    if (s.pump === 'pressure') {
      const v = +s.pressure, from = smooth && prevP != null ? prevP : v;
      if (handoffIn) { out.t.push(clock); out.p.push(0); out.f.push(null); out.T.push(temp); }
      out.t.push(clock, clock + dur); out.p.push(from, v); out.f.push(null, null); out.T.push(temp, temp);
      prevP = v;
      // Insight drops the pressure line to 0 where pressure control hands off to flow
      if (next && next.s.pump !== 'pressure') { out.t.push(clock + dur); out.p.push(0); out.f.push(null); out.T.push(temp); }
    } else {
      const v = +s.flow, from = smooth && prevF != null ? prevF : v;
      if (handoffIn) { out.t.push(clock); out.f.push(0); out.p.push(null); out.T.push(temp); }
      out.t.push(clock, clock + dur); out.f.push(from, v); out.p.push(null, null); out.T.push(temp, temp);
      prevF = v;
      if (next && next.s.pump !== 'flow') { out.t.push(clock + dur); out.f.push(0); out.p.push(null); out.T.push(temp); }
    }
    clock += dur;
  }
  return out;
}

// Is the current page a "ready" preview page (show profile preview, not a shot)?
const isPreviewPage = (p) => currentFamily === 'espresso' && baseOf(p) === families.espresso.base;

// Steam-heater enable: de1app disables the heater by sending steam target temp 0
// (firmware treats <135 as off). reaprime has no disable flag but accepts
// targetTemperature 0, so we do the same and remember the desired temp locally
// (sending 0 would otherwise lose it — the Tcl keeps it as a separate setting).
const STEAM_DESIRED_KEY = 'insight_steam_desired_temp';
const steamDesiredTemp = () => { const v = parseFloat(localStorage.getItem(STEAM_DESIRED_KEY)); return v >= 135 ? v : 150; };

let currentFamily = 'espresso', machineState = 'idle';
let shotStart = null, curWeight = 0, saveT = null, activeChart = null;
// temperature-zoom Y-scale levels (tap top half to zoom in, bottom to zoom out)
const TEMP_RANGES = [[78, 92], [84, 92], [87, 91]];
let tempLevel = 0;
function applyTempRange() {
  if (activeChart && activeChart.setTempRange) activeChart.setTempRange(TEMP_RANGES[tempLevel]);
}

const PAGE_GRAPH = { off: 'espresso_chart', espresso: 'espresso_chart', espresso_3: 'espresso_chart',
  off_zoomed: 'zoom_pf', espresso_zoomed: 'zoom_pf', espresso_3_zoomed: 'zoom_pf',
  off_zoomed_temperature: 'zoom_temp', espresso_zoomed_temperature: 'zoom_temp', espresso_3_zoomed_temperature: 'zoom_temp' };
const baseOf = (p) => p.replace(/_zoomed(_temperature)?$/, '');

function showPage(p) {
  live.pageState = p; host.show(p); host.update(live);
  activeChart = host.graphs[PAGE_GRAPH[p]] || null;
  if (activeChart) {
    if (activeChart.setTheme) activeChart.setTheme(curTheme());
    activeChart.resize();
    if (isPreviewPage(p) && activeChart.renderPreview) activeChart.renderPreview(preview);
    else activeChart.render(buf);
  }
  // steam/water running-page mini graph: theme + size + (re)draw the run so far
  const mini = p === 'steam' ? host.graphs.steam_mini : (p === 'water' ? host.graphs.water_mini : null);
  if (mini) { if (mini.setTheme) mini.setTheme(curTheme()); mini.resize(); mini.render(runBuf); }
}
function setFamily(fam) { currentFamily = fam; live.family = fam; showPage(families[fam].base); writeHash('#/' + fam); }

// --- Hash routing: #/<family> and #/settings/<tab> so each tab has a URL that
// survives a refresh and can be bookmarked. We push our own routes with
// pushState (which does not fire hashchange), and re-apply on back/forward
// (popstate) and manual hash edits (hashchange). applyingRoute suppresses the
// write-back while we are applying an incoming route, so there is no loop.
const FAM_ROUTES = ['espresso', 'steam', 'water', 'flush'];
const SETTINGS_TABS = ['presets', 'advanced', 'machine', 'app'];
let applyingRoute = false;
function writeHash(h) { if (applyingRoute) return; if (location.hash !== h) history.pushState(null, '', h); }
const settingsHooks = {
  onTab: (tab) => writeHash('#/settings/' + tab),
  onClose: () => writeHash('#/' + currentFamily),
  // New-Preset chooser opened/closed -> deep-link so a refresh re-shows the chooser.
  onChooser: (open) => writeHash(open ? '#/settings/presets/new' : '#/settings/presets'),
  // Profile editor (pressure) -> deep-link by name so a refresh re-opens the editor.
  onEditProfile: (name) => writeHash('#/settings/presets/profile/edit/' + encodeURIComponent(name || 'Untitled')),
};
async function applyRoute() {
  applyingRoute = true;
  try {
    const parts = (location.hash || '').replace(/^#\/?/, '').split('/').filter(Boolean);
    if (parts[0] === 'settings') {
      // #/settings/presets/profile/edit/<name> -> open the profile editor for <name>.
      // Enter via a neutral tab (not presets): loadPresets auto-selects a preset
      // and debounce-loads it onto the workflow, which would clobber our load.
      if (parts[1] === 'presets' && parts[2] === 'profile' && parts[3] === 'edit') {
        if (!isSettingsOpen()) await openSettings('machine', settingsHooks);
        await settingsEditProfile(parts.slice(4).join('/'));
        return;
      }
      const tab = SETTINGS_TABS.includes(parts[1]) ? parts[1] : 'machine';
      if (!isSettingsOpen()) await openSettings(tab, settingsHooks); else await settingsGoto(tab);
      // #/settings/presets/new re-opens the chooser once the presets tab is ready.
      if (parts[1] === 'presets' && parts[2] === 'new') settingsShowChooser();
    } else {
      if (isSettingsOpen()) closeSettings();
      setFamily(FAM_ROUTES.includes(parts[0]) ? parts[0] : 'espresso');
    }
  } finally { applyingRoute = false; }
}
window.addEventListener('popstate', applyRoute);
window.addEventListener('hashchange', applyRoute);
// Language change (from Settings › Language): re-render the current page so the
// i18n-bound labels (tab names, etc.) pick up the new language.
window.addEventListener('insight-langchange', () => { if (live.pageState) showPage(live.pageState); });
// Settings loaded a different profile onto the DE1 — re-read the workflow so the
// espresso page (title / type / preview curve) reflects the newly-loaded profile.
window.addEventListener('insight-workflow-changed', () => { loadWorkflow(); });
// Theme change (Settings › Misc › Insight Dark): re-render so the dark image set
// + dark ink take effect immediately, and restyle the live chart for dark cards.
window.addEventListener('insight-themechange', () => {
  for (const id in host.graphs) { const g = host.graphs[id]; if (g && g.setTheme) g.setTheme(curTheme()); }
  if (live.pageState) showPage(live.pageState);
});

// Screensaver: sleep the machine and show the rotating-image saver; a tap wakes.
// Opening is guarded (safe to call from both the sleep button and the state
// snapshot, so an externally-triggered sleep also shows the saver).
function wake() { api.setMachineState('idle').catch((e) => logger.warn('wake', e)); api.restoreDisplay(); }
function showSaver() { api.dimDisplay(); openSaver(wake); }

const actions = {
  navFlush: () => setFamily('flush'), navEspresso: () => setFamily('espresso'),
  navSteam: () => setFamily('steam'), navWater: () => setFamily('water'),
  startEspresso: () => { api.tareScale().catch(() => {}); api.setMachineState('espresso'); },
  startSteam: () => api.setMachineState('steam'),
  startWater: () => { api.tareScale().catch(() => {}); api.setMachineState('hotWater'); },
  startFlush: () => api.setMachineState('flush'),
  stopEspresso: () => api.setMachineState('idle'), stopSteam: () => api.setMachineState('idle'),
  stopWater: () => api.setMachineState('idle'), stopFlush: () => api.setMachineState('idle'),
  skipStep: () => api.setMachineState('skipStep').catch(() => {}),
  sleep: () => { api.setMachineState('sleeping').catch((e) => logger.warn('sleep', e)); showSaver(); },
  settings: () => openSettings(settingsLastTab(), settingsHooks),
  editProfile: () => openProfileEditor(() => { loadWorkflow(); host.update(live); }),
  describe: () => openDYE(),
  profileSelect: () => openProfileSelector((p) => { live.profileTitle = p.title; loadWorkflow(); host.update(live); }),
  zoomPF: () => showPage(baseOf(live.pageState) + '_zoomed'),
  zoomTemp: () => { tempLevel = 0; showPage(baseOf(live.pageState) + '_zoomed_temperature'); },
  unzoom: () => showPage(baseOf(live.pageState)),
  toggleSteam: () => {
    live.steamEnabled = !live.steamEnabled;
    if (live.steamEnabled) live.steamTarget = steamDesiredTemp();          // restore desired
    else if (live.steamTarget >= 135) localStorage.setItem(STEAM_DESIRED_KEY, String(live.steamTarget));
    host.update(live);
    // same method as Tcl: disable heater by sending steam target temperature 0
    api.updateWorkflow({ steamSettings: { targetTemperature: live.steamEnabled ? live.steamTarget : 0 } })
      .catch((e) => logger.warn('steam toggle', e));
  },
  toggleResistance: () => {
    live.resistanceOn = !live.resistanceOn; host.update(live);
    if (activeChart && activeChart.setResistance) activeChart.setResistance(live.resistanceOn, buf);
  },
  tempZoomIn: () => { tempLevel = Math.min(TEMP_RANGES.length - 1, tempLevel + 1); applyTempRange(); },
  tempZoomOut: () => { if (tempLevel === 0) return actions.unzoom(); tempLevel -= 1; applyTempRange(); },
  adjust: (el) => {
    const a = el.adj; let v = (live[a.key] ?? a.min) + a.delta;
    v = Math.min(a.max, Math.max(a.min, v)); live[a.key] = v; host.update(live);
    clearTimeout(saveT); saveT = setTimeout(() => api.updateWorkflow(a.set(v)).catch((e) => logger.warn('save', e)), 300);
  },
  slideFlow: (el, hostRef, value) => {
    const a = el.adj; live[a.key] = value; host.update(live);
    clearTimeout(saveT); saveT = setTimeout(() => api.updateWorkflow(a.set(value)).catch((e) => logger.warn('slide', e)), 200);
  },
  numpad: (el) => {
    const n = el.np;
    openNumpad({ title: n.title, value: live[n.key] ?? n.min, min: n.min, max: n.max,
      step: n.step || 1, bigStep: n.bigStep || 10, decimals: n.decimals || 0,
      onOk: (v) => { live[n.key] = v; host.update(live); api.updateWorkflow(n.set(v)).catch((e) => logger.warn('numpad save', e)); } });
  },
};

const host = new PageHost(stage, config, actions);
host.registerGraph('espresso_chart', (n) => new EspressoChart(n));
host.registerGraph('zoom_pf', (n) => new ZoomChart(n, 'pf'));
host.registerGraph('zoom_temp', (n) => new ZoomChart(n, 'temp'));
host.registerGraph('steam_mini', (n) => new MiniChart(n, { series: [{ key: 'temp', color: '#ff7880' }], title: 'Steam temperature (°C)', titleColor: '#ff7880' }));
host.registerGraph('water_mini', (n) => new MiniChart(n, { series: [{ key: 'temp', color: '#ff7880' }, { key: 'w', color: '#a2693d' }], title: 'Temperature (°C) · weight (g)', titleColor: '#ff7880' }));

async function loadWorkflow() {
  try {
    const wf = await api.getWorkflow();
    const steps = wf?.profile?.steps || [];
    currentSteps = steps;                              // for the "Current step" card row
    live.profileTitle = wf?.profile?.title || '';
    live.profileType = profileTypeText(steps);
    live.targetTemp = steps?.[0]?.temperature || live.targetTemp;
    live.targetWeight = wf?.context?.targetYield || wf?.profile?.target_weight || 0;
    live.targetVolume = wf?.profile?.target_volume || wf?.context?.targetYield || 0;
    preview = buildPreview(steps);
    if (wf?.steamSettings?.duration != null) live.steamDuration = wf.steamSettings.duration;
    if (wf?.steamSettings?.targetTemperature != null) {
      const t = wf.steamSettings.targetTemperature;
      live.steamEnabled = t >= 135;                 // <135 => heater off (firmware convention)
      if (t >= 135) { live.steamTarget = t; localStorage.setItem(STEAM_DESIRED_KEY, String(t)); }
      else live.steamTarget = steamDesiredTemp();   // heater off: show remembered desired temp
    }
    if (wf?.steamSettings?.flow != null) live.steamFlowMax = wf.steamSettings.flow;
    if (wf?.hotWaterData?.volume != null) live.waterVolume = wf.hotWaterData.volume;
    if (wf?.hotWaterData?.targetTemperature != null) live.waterTemp = wf.hotWaterData.targetTemperature;
    if (wf?.hotWaterData?.flow != null) live.waterFlowMax = wf.hotWaterData.flow;
    if (wf?.rinseData?.duration != null) live.flushSeconds = wf.rinseData.duration;
    if (wf?.rinseData?.flow != null) live.flushFlowMax = wf.rinseData.flow;
    host.update(live);
    if (activeChart && isPreviewPage(live.pageState) && activeChart.renderPreview) activeChart.renderPreview(preview);
  } catch (e) { logger.warn('workflow', e); }
}

function onSnapshot(d) {
  const st = (d.state && d.state.state) || d.state;
  live.substate = (d.state && d.state.substate) || '';
  live.pressure = d.pressure; live.flow = d.flow; live.mixTemp = d.mixTemperature;
  live.groupTemp = d.groupTemperature; live.steamTemp = d.steamTemperature;
  live.coffeeTemp = d.mixTemperature; live.metalTemp = d.groupTemperature;
  // "Current step" = frame index (1-based) + the step's name, from the loaded profile
  const fr = (typeof d.profileFrame === 'number') ? d.profileFrame : null;
  live.currentStep = (fr != null && currentSteps[fr]) ? `${fr + 1}: ${currentSteps[fr].name || currentSteps[fr].pump || ''}` : (fr != null ? `${fr + 1}` : '');

  if (st !== machineState) { onStateChange(machineState, st); machineState = st; }

  if (st === 'espresso') {
    const now = performance.now();
    live.elapsed = shotStart ? (now - shotStart) / 1000 : 0;
    const dv = lastVolT != null ? (d.flow || 0) * ((now - lastVolT) / 1000) : 0;
    lastVolT = now;
    live.totalVolume += dv;
    // preinfusion until the shot builds pressure (exit condition), then pouring
    if (!poured) {
      live.preinfVolume += dv; live.preinfElapsed = live.elapsed;
      if (d.pressure >= 4) { poured = true; preinfEnd = live.elapsed; }
    } else {
      live.pourVolumeOnly += dv; live.pourElapsed = live.elapsed - preinfEnd;
    }
    buf.t.push(live.elapsed); buf.p.push(d.pressure); buf.pg.push(d.targetPressure);
    buf.f.push(d.flow); buf.fg.push(d.targetFlow); buf.w.push(curWeight);
    buf.T.push(d.mixTemperature); buf.Tg.push(d.targetMixTemperature);
    // puck resistance = pressure / flow^2 (laminar), like Insight's resistance curve
    buf.r.push(d.flow > 0.2 ? +(d.pressure / (d.flow * d.flow)).toFixed(2) : null);
    if (activeChart) activeChart.render(buf);
  } else if (st === 'steam' || st === 'hotWater') {
    // feed the running-page mini graph (steam temperature, or water temp+weight)
    const el = runStart ? (performance.now() - runStart) / 1000 : 0;
    runBuf.t.push(el);
    runBuf.temp.push(st === 'steam' ? d.steamTemperature : d.mixTemperature);
    runBuf.w.push(curWeight);
    const mini = host.graphs[st === 'steam' ? 'steam_mini' : 'water_mini'];
    if (mini) mini.render(runBuf);
  }
  host.update(live);
}

function resetShotStats() {
  poured = false; preinfEnd = 0; lastVolT = null;
  Object.assign(live, { elapsed: 0, preinfElapsed: 0, pourElapsed: 0, doneElapsed: 0,
    preinfVolume: 0, pourVolumeOnly: 0, totalVolume: 0 });
  clearInterval(doneTimer); doneTimer = null; doneStart = null;
}

// After a shot ends, Insight counts "Ns done" on the ready page for a while.
function startDoneTimer() {
  clearInterval(doneTimer); doneStart = performance.now();
  doneTimer = setInterval(() => {
    live.doneElapsed = (performance.now() - doneStart) / 1000;
    if (live.doneElapsed > 120) { clearInterval(doneTimer); doneTimer = null; }
    host.update(live);
  }, 1000);
}

function onStateChange(prev, next) {
  logger.info(`machine ${prev} -> ${next}`);
  if (next === 'sleeping') { showSaver(); return; }        // asleep => dim + screensaver
  if (prev === 'sleeping') { api.restoreDisplay(); if (isSaverOpen()) closeSaver(); }  // woke => restore + dismiss
  const runFam = stateToFamily[next], prevFam = stateToFamily[prev];
  if (runFam) {
    currentFamily = runFam; live.family = runFam;
    if (next === 'espresso') { shotStart = performance.now(); resetShotStats(); resetBuf(); }
    if (next === 'steam' || next === 'hotWater') { runStart = performance.now(); resetRunBuf(); }
    showPage(families[runFam].run);
  } else if (prevFam && (next === 'idle' || next === 'ready')) {
    if (prevFam === 'espresso') startDoneTimer();
    showPage(families[prevFam].done);
  } else if (next === 'idle') {
    showPage(families[currentFamily].base);
  }
}

function onScale(d) { if (typeof d.weight === 'number') { curWeight = d.weight; live.weight = d.weight; } }

async function init() {
  if (localStorage.getItem('theme') === 'dark') document.documentElement.dataset.theme = 'dark';  // restore saved theme
  initI18n();                                                // load the translation CSV (async; re-renders on ready)
  applyRoute();                                              // restore tab/settings from the URL
  if (!location.hash) history.replaceState(null, '', '#/' + currentFamily);  // canonicalise bare URL
  await loadWorkflow();
  api.connectDisplay();
  api.connectSnapshot(onSnapshot);
  api.connectScale(onScale);
}
init();
