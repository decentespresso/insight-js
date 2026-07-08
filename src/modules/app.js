// Insight skin bootstrap (faithful, multi-family + zoom). Drives PageHost across
// espresso/steam/water/flush, renders charts from a shared shot buffer (so the
// zoomed view shows full history), and maps machine state -> page.
import * as api from './api.js';
import { logger, setDebug } from './logger.js';
import { PageHost } from './page.js';
import { EspressoChart, ZoomChart } from './chart.js';
import { config, families, stateToFamily } from '../config/index.js';
import { openProfileSelector } from '../views/profile_selector.js';
import { openDYE } from '../views/dye.js';
import { openSettings } from '../views/settings.js';
import { openProfileEditor } from '../views/profile_editor.js';

setDebug(true);

const stage = document.getElementById('stage');
const live = { pageState: 'off', substate: '', pressure: 0, flow: 0, mixTemp: 0, groupTemp: 0,
  steamTemp: 0, targetTemp: 0, weight: 0, elapsed: 0, pourVolume: 0, profileTitle: '',
  targetWeight: 0, currentStep: '', steamDuration: 30, waterVolume: 50, waterTemp: 90, flushSeconds: 10 };

// shared shot data buffer (all charts render from it)
const buf = { t: [], p: [], pg: [], f: [], fg: [], w: [], T: [], Tg: [] };
const resetBuf = () => { for (const k in buf) buf[k] = []; };

let currentFamily = 'espresso', machineState = 'idle';
let shotStart = null, lastT = null, curWeight = 0, saveT = null, activeChart = null;

const PAGE_GRAPH = { off: 'espresso_chart', espresso: 'espresso_chart', espresso_3: 'espresso_chart',
  off_zoomed: 'zoom_pf', espresso_zoomed: 'zoom_pf', espresso_3_zoomed: 'zoom_pf',
  off_zoomed_temperature: 'zoom_temp', espresso_zoomed_temperature: 'zoom_temp', espresso_3_zoomed_temperature: 'zoom_temp' };
const baseOf = (p) => p.replace(/_zoomed(_temperature)?$/, '');

function showPage(p) {
  live.pageState = p; host.show(p); host.update(live);
  activeChart = host.graphs[PAGE_GRAPH[p]] || null;
  if (activeChart) { activeChart.resize(); activeChart.render(buf); }
}
function setFamily(fam) { currentFamily = fam; showPage(families[fam].base); }

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
  sleep: () => api.setMachineState('sleeping'),
  settings: () => openSettings(),
  editProfile: () => openProfileEditor(() => { loadWorkflow(); host.update(live); }),
  describe: () => openDYE(),
  profileSelect: () => openProfileSelector((p) => { live.profileTitle = p.title; loadWorkflow(); host.update(live); }),
  zoomPF: () => showPage(baseOf(live.pageState) + '_zoomed'),
  zoomTemp: () => showPage(baseOf(live.pageState) + '_zoomed_temperature'),
  unzoom: () => showPage(baseOf(live.pageState)),
  adjust: (el) => {
    const a = el.adj; let v = (live[a.key] ?? a.min) + a.delta;
    v = Math.min(a.max, Math.max(a.min, v)); live[a.key] = v; host.update(live);
    clearTimeout(saveT); saveT = setTimeout(() => api.updateWorkflow(a.set(v)).catch((e) => logger.warn('save', e)), 300);
  },
};

const host = new PageHost(stage, config, actions);
host.registerGraph('espresso_chart', (n) => new EspressoChart(n));
host.registerGraph('zoom_pf', (n) => new ZoomChart(n, 'pf'));
host.registerGraph('zoom_temp', (n) => new ZoomChart(n, 'temp'));

async function loadWorkflow() {
  try {
    const wf = await api.getWorkflow();
    live.profileTitle = wf?.profile?.title || '';
    live.targetTemp = wf?.profile?.steps?.[0]?.temperature || live.targetTemp;
    live.targetWeight = wf?.context?.targetYield || wf?.profile?.target_weight || 0;
    if (wf?.steamSettings?.duration != null) live.steamDuration = wf.steamSettings.duration;
    if (wf?.hotWaterData?.volume != null) live.waterVolume = wf.hotWaterData.volume;
    if (wf?.hotWaterData?.targetTemperature != null) live.waterTemp = wf.hotWaterData.targetTemperature;
    if (wf?.rinseData?.duration != null) live.flushSeconds = wf.rinseData.duration;
    host.update(live);
  } catch (e) { logger.warn('workflow', e); }
}

function onSnapshot(d) {
  const st = (d.state && d.state.state) || d.state;
  live.substate = (d.state && d.state.substate) || '';
  live.pressure = d.pressure; live.flow = d.flow; live.mixTemp = d.mixTemperature;
  live.groupTemp = d.groupTemperature; live.steamTemp = d.steamTemperature;
  if (baseOf(live.pageState) === 'espresso') live.targetTemp = d.mixTemperature;
  live.currentStep = d.currentFrameDescription || d.stepName || live.currentStep;

  if (st !== machineState) { onStateChange(machineState, st); machineState = st; }

  if (st === 'espresso') {
    const now = performance.now();
    live.elapsed = shotStart ? (now - shotStart) / 1000 : 0;
    if (lastT != null) live.pourVolume += (d.flow || 0) * ((now - lastT) / 1000);
    lastT = now;
    buf.t.push(live.elapsed); buf.p.push(d.pressure); buf.pg.push(d.targetPressure);
    buf.f.push(d.flow); buf.fg.push(d.targetFlow); buf.w.push(curWeight);
    buf.T.push(d.mixTemperature); buf.Tg.push(d.targetMixTemperature);
    if (activeChart) activeChart.render(buf);
  }
  host.update(live);
}

function onStateChange(prev, next) {
  logger.info(`machine ${prev} -> ${next}`);
  const runFam = stateToFamily[next], prevFam = stateToFamily[prev];
  if (runFam) {
    currentFamily = runFam;
    if (next === 'espresso') { shotStart = performance.now(); lastT = null; live.pourVolume = 0; live.elapsed = 0; resetBuf(); }
    showPage(families[runFam].run);
  } else if (prevFam && (next === 'idle' || next === 'ready')) {
    showPage(families[prevFam].done);
  } else if (next === 'idle') {
    showPage(families[currentFamily].base);
  }
}

function onScale(d) { if (typeof d.weight === 'number') { curWeight = d.weight; live.weight = d.weight; } }

async function init() {
  setFamily('espresso');
  await loadWorkflow();
  api.connectSnapshot(onSnapshot);
  api.connectScale(onScale);
}
init();
