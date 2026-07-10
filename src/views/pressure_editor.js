// Spec-driven step-profile editor (Tcl settings_2a PRESSURE / settings_2b FLOW).
// Rendered as one overlay in 2560x1600 space over the baked settings_2a2/2b
// frame: an explanation chart with a colour-banded target curve, three step
// cards + a nested stop-at-weight card, and custom grey-trough/coloured-thumb
// sliders at the exact Tcl coordinates. Pressure and flow share ALL of this
// machinery and differ only in their SPEC (sliders/labels/chart axis/model).
import { LIMITS, buildPressureSteps, pressureCurve, parsePressure } from '../config/pressure_profile.js';
import { FLOW_LIMITS, buildFlowSteps, flowCurve, parseFlow } from '../config/flow_profile.js';
import { openNumpad } from './numpad.js';
import { t } from '../modules/i18n.js';
import { logger } from '../modules/logger.js';

const BLUE = '#4e85f4', GREY = '#7f879a';
const TEMP = { min: 20, max: 105 };
const n1 = (v) => (Number(v) || 0).toFixed(1);
const r0 = (v) => Math.round(Number(v) || 0);
const TEMPS = [{ x: 820, y: 760 }, { x: 1666, y: 760 }, { x: 2510, y: 760 }];   // per-card temp, shared
const TEMP_EDIT = { title: 'Temperature', min: 20, max: 105, step: 0.5, big: 5, dec: 1 };

// ---- PRESSURE spec (settings_2a) ----
export const PRESSURE_SPEC = {
  id: 'pressure',
  build: buildPressureSteps, curve: pressureCurve, parse: parsePressure,
  yLabel: 'pressure (bar)', yMax: 12.4, yTicks: [1, 3, 5, 7, 9, 11],
  titles: [
    { t: '1: preinfuse', x: 45, y: 755 }, { t: '2: rise and hold', x: 890, y: 755 },
    { t: '3: decline', x: 1730, y: 755 }, { t: 'Limit flow', x: 890, y: 1120, sm: true },
    { t: '4: stop at weight:', x: 1730, y: 1100 },
  ],
  sliders: [
    { key: 'time', o: 'h', r: [47, 850, 647, 1000], lim: LIMITS.time, c: 'g' },
    { key: 'stopPressure', o: 'v', r: [670, 850, 820, 1320], lim: LIMITS.stopPressure, c: 'g', inv: true },
    { key: 'flow', o: 'h', r: [47, 1175, 647, 1325], lim: LIMITS.flow, c: 'g' },
    { key: 'holdTime', o: 'h', r: [892, 850, 1492, 1000], lim: LIMITS.time, c: 't' },
    { key: 'pressure', o: 'v', r: [1516, 850, 1666, 1320], lim: LIMITS.pressure, c: 't', inv: true },
    { key: 'maxFlow', o: 'h', r: [892, 1175, 1438, 1325], lim: LIMITS.maxFlow, c: 't' },
    { key: 'declineTime', o: 'h', r: [1730, 850, 2335, 1000], lim: LIMITS.time, c: 'r' },
    { key: 'pressureEnd', o: 'v', r: [2360, 850, 2510, 1320], lim: LIMITS.pressure, c: 'r', inv: true },
    { key: 'weight', o: 'h', r: [1730, 1175, 2276, 1325], lim: { min: 0, max: 2000, step: 0.2 }, c: 'r' },
  ],
  vals: [
    { key: 'time', x: 47, y: 1000, a: 'nw', fmt: (p) => `< ${r0(p.time)} seconds` },
    { key: 'flow', x: 47, y: 1325, a: 'nw', fmt: (p) => `${n1(p.flow)} mL/s` },
    { key: 'stopPressure', x: 820, y: 1325, a: 'ne', fmt: (p) => `< ${n1(p.stopPressure)} bar` },
    { key: 'holdTime', x: 892, y: 1000, a: 'nw', fmt: (p) => `${r0(p.holdTime)} seconds` },
    { key: 'pressure', x: 1667, y: 1325, a: 'ne', fmt: (p) => `${n1(p.pressure)} bar` },
    { key: 'maxFlow', x: 892, y: 1325, a: 'nw', fmt: (p) => (p.maxFlow > 0 ? `${n1(p.maxFlow)} mL/s` : 'off') },
    { key: 'declineTime', x: 1735, y: 1000, a: 'nw', fmt: (p) => `${r0(p.declineTime)} seconds` },
    { key: 'pressureEnd', x: 2510, y: 1325, a: 'ne', fmt: (p) => `${n1(p.pressureEnd)} bar` },
    { key: 'weight', x: 1730, y: 1325, a: 'nw', fmt: (p) => `${n1(p.weight)}g` },
  ],
  edit: {
    time: { title: 'Time', min: 0, max: 60, step: 1, big: 10, dec: 0 },
    flow: { title: 'Flow rate', min: 1, max: 8, step: 0.1, big: 1, dec: 1 },
    stopPressure: { title: 'Pressure', min: 1, max: 12, step: 0.1, big: 1, dec: 1 },
    holdTime: { title: 'Time', min: 0, max: 60, step: 1, big: 10, dec: 0 },
    pressure: { title: 'Pressure', min: 1, max: 12, step: 0.1, big: 1, dec: 1 },
    maxFlow: { title: 'Flow rate', min: 0, max: 8, step: 0.1, big: 1, dec: 1 },
    declineTime: { title: 'Time', min: 0, max: 60, step: 1, big: 10, dec: 0 },
    pressureEnd: { title: 'Pressure', min: 1, max: 12, step: 0.1, big: 1, dec: 1 },
    weight: { title: 'Stop at weight', min: 1, max: 2000, step: 0.1, big: 10, dec: 1 },
  },
};

// ---- FLOW spec (settings_2b): same layout, flow-pumped bindings ----
export const FLOW_SPEC = {
  id: 'flow',
  build: buildFlowSteps, curve: flowCurve, parse: parseFlow,
  yLabel: 'Flow rate', yMax: 8.5, yTicks: [1, 2, 3, 4, 5, 6, 7, 8],
  titles: [
    { t: '1: preinfuse', x: 45, y: 755 }, { t: '2: hold', x: 890, y: 755 },
    { t: '3: decline', x: 1730, y: 755 }, { t: 'Limit pressure', x: 890, y: 1120, sm: true },
    { t: '4: stop at weight:', x: 1730, y: 1100 },
  ],
  sliders: [
    { key: 'time', o: 'h', r: [47, 850, 647, 1000], lim: FLOW_LIMITS.time, c: 'g' },
    { key: 'flow', o: 'v', r: [670, 850, 820, 1320], lim: FLOW_LIMITS.flow, c: 'g', inv: true },
    { key: 'stopPressure', o: 'h', r: [47, 1175, 647, 1325], lim: FLOW_LIMITS.stopPressure, c: 'g' },
    { key: 'holdTime', o: 'h', r: [892, 850, 1492, 1000], lim: FLOW_LIMITS.holdTime, c: 't' },
    { key: 'flowHold', o: 'v', r: [1516, 850, 1666, 1320], lim: FLOW_LIMITS.flowHold, c: 't', inv: true },
    { key: 'maxPressure', o: 'h', r: [892, 1175, 1438, 1325], lim: FLOW_LIMITS.maxPressure, c: 't' },
    { key: 'declineTime', o: 'h', r: [1730, 850, 2335, 1000], lim: FLOW_LIMITS.declineTime, c: 'r' },
    { key: 'flowDecline', o: 'v', r: [2360, 850, 2510, 1320], lim: FLOW_LIMITS.flowDecline, c: 'r', inv: true },
    { key: 'weight', o: 'h', r: [1730, 1175, 2276, 1325], lim: { min: 0, max: 2000, step: 0.2 }, c: 'r' },
  ],
  vals: [
    { key: 'time', x: 47, y: 1000, a: 'nw', fmt: (p) => `< ${r0(p.time)} seconds` },
    { key: 'stopPressure', x: 47, y: 1325, a: 'nw', fmt: (p) => `< ${n1(p.stopPressure)} bar` },
    { key: 'flow', x: 820, y: 1325, a: 'ne', fmt: (p) => `${n1(p.flow)} mL/s` },
    { key: 'holdTime', x: 892, y: 1000, a: 'nw', fmt: (p) => `${r0(p.holdTime)} seconds` },
    { key: 'flowHold', x: 1667, y: 1325, a: 'ne', fmt: (p) => `${n1(p.flowHold)} mL/s` },
    { key: 'maxPressure', x: 892, y: 1325, a: 'nw', fmt: (p) => (p.maxPressure > 0 ? `${n1(p.maxPressure)} bar` : 'off') },
    { key: 'declineTime', x: 1735, y: 1000, a: 'nw', fmt: (p) => (p.declineTime > 0 ? `${r0(p.declineTime)} seconds` : 'off') },
    { key: 'flowDecline', x: 2510, y: 1325, a: 'ne', fmt: (p) => `${n1(p.flowDecline)} mL/s` },
    { key: 'weight', x: 1730, y: 1325, a: 'nw', fmt: (p) => `${n1(p.weight)}g` },
  ],
  edit: {
    time: { title: 'Time', min: 0, max: 60, step: 1, big: 10, dec: 0 },
    flow: { title: 'Flow rate', min: 1, max: 8, step: 0.1, big: 1, dec: 1 },
    stopPressure: { title: 'Pressure', min: 1, max: 12, step: 0.1, big: 1, dec: 1 },
    holdTime: { title: 'Time', min: 0, max: 60, step: 1, big: 10, dec: 0 },
    flowHold: { title: 'Flow rate', min: 0, max: 8, step: 0.1, big: 1, dec: 1 },
    maxPressure: { title: 'Pressure', min: 0, max: 12, step: 0.1, big: 1, dec: 1 },
    declineTime: { title: 'Time', min: 0, max: 60, step: 1, big: 10, dec: 0 },
    flowDecline: { title: 'Flow rate', min: 0, max: 8, step: 0.1, big: 1, dec: 1 },
    weight: { title: 'Stop at weight', min: 1, max: 2000, step: 0.1, big: 10, dec: 1 },
  },
};

let spec = PRESSURE_SPEC;   // active spec
let els = null;             // cached DOM handles
let chartMount = null;

function editParam(live, key, onChange) {
  const e = (key.startsWith('temp') ? TEMP_EDIT : spec.edit[key]); if (!e) return;
  openNumpad({ title: t(e.title), value: live._pp[key], min: e.min, max: e.max, step: e.step, bigStep: e.big, decimals: e.dec,
    onOk: (v) => { live._pp[key] = v; regen(live); refresh(live); onChange(); } });
}

// Build (once per spec) the overlay DOM.
function build(live, onChange) {
  const box = document.createElement('div');
  box.className = 'pp-editor'; box.dataset.spec = spec.id;
  chartMount = document.createElement('div'); chartMount.className = 'pp-chart'; box.appendChild(chartMount);

  for (const ti of spec.titles) {
    const d = document.createElement('div');
    d.className = 'pp-title' + (ti.sm ? ' sm' : '');
    d.style.left = ti.x + 'px'; d.style.top = ti.y + 'px'; d.textContent = t(ti.t);
    box.appendChild(d);
  }
  const valEls = {};
  for (const v of spec.vals) {
    const d = document.createElement('div');
    d.className = 'pp-val ' + v.a; d.style.left = v.x + 'px'; d.style.top = v.y + 'px';
    d.addEventListener('click', () => editParam(live, v.key, onChange));
    box.appendChild(d); valEls[v.key] = { el: d, fmt: v.fmt };
  }
  const tempKeys = ['temp1', 'temp2', 'temp3'];
  const tempEls = TEMPS.map((tp, i) => {
    const d = document.createElement('div');
    d.className = 'pp-temp ne'; d.style.left = tp.x + 'px'; d.style.top = tp.y + 'px';
    d.addEventListener('click', () => { if (live._pp.tempSteps) editParam(live, tempKeys[i], onChange); });
    box.appendChild(d); return d;
  });
  const mainTemp = document.createElement('div'); mainTemp.className = 'pp-maintemp'; box.appendChild(mainTemp);

  const sliderEls = {};
  for (const s of spec.sliders) {
    const [x1, y1, x2, y2] = s.r;
    const sl = document.createElement('div');
    sl.className = `pp-slider ${s.o} stage-${s.c}`;
    Object.assign(sl.style, { left: x1 + 'px', top: y1 + 'px', width: (x2 - x1) + 'px', height: (y2 - y1) + 'px' });
    const thumb = document.createElement('div'); thumb.className = 'pp-thumb'; sl.appendChild(thumb);
    box.appendChild(sl); sliderEls[s.key] = { thumb, spec: s };
    attachDrag(sl, s, live, onChange);
  }
  els = { valEls, tempEls, mainTemp, sliderEls };
  return box;
}

function attachDrag(sl, sspec, live, onChange) {
  const setFromEvent = (ev) => {
    const rect = sl.getBoundingClientRect();
    let frac = sspec.o === 'h' ? (ev.clientX - rect.left) / rect.width : (ev.clientY - rect.top) / rect.height;
    frac = Math.max(0, Math.min(1, frac));
    if (sspec.inv) frac = 1 - frac;
    const { min, max, step } = sspec.lim;
    let val = min + frac * (max - min);
    val = Math.max(min, Math.min(max, Math.round(val / step) * step));
    live._pp[sspec.key] = val;
    regen(live); refresh(live); onChange();
  };
  let dragging = false;
  sl.addEventListener('pointerdown', (ev) => { dragging = true; sl.setPointerCapture?.(ev.pointerId); setFromEvent(ev); ev.preventDefault(); });
  sl.addEventListener('pointermove', (ev) => { if (dragging) setFromEvent(ev); });
  const up = (ev) => { dragging = false; try { sl.releasePointerCapture?.(ev.pointerId); } catch (e) { /* */ } };
  sl.addEventListener('pointerup', up); sl.addEventListener('pointercancel', up);
}

function regen(live) {
  if (!live._advProfile) live._advProfile = { steps: [] };
  live._advProfile.steps = spec.build(live._pp);
}

function refresh(live) {
  if (!els) return;
  const p = live._pp;
  for (const k in els.valEls) els.valEls[k].el.textContent = els.valEls[k].fmt(p);
  if (p.tempSteps) {
    els.tempEls[0].textContent = `${r0(p.temp1)}°C`;
    els.tempEls[1].textContent = `${r0(p.temp2)}°C`;
    els.tempEls[2].textContent = `${r0(p.temp3)}°C`;
  } else els.tempEls.forEach((d) => { d.textContent = ''; });
  els.mainTemp.textContent = `${r0(p.temp)}°C`;
  for (const k in els.sliderEls) {
    const { thumb, spec: ss } = els.sliderEls[k];
    const { min, max } = ss.lim;
    let frac = Math.max(0, Math.min(1, (p[k] - min) / (max - min || 1)));
    if (ss.inv) frac = 1 - frac;
    if (ss.o === 'h') thumb.style.left = `calc(${frac} * (100% - var(--pp-thumb)))`;
    else thumb.style.top = `calc(${frac} * (100% - var(--pp-thumb)))`;
  }
  drawChart(p);
}

function drawChart(p) {
  if (!chartMount || !window.Plotly) return;
  const { bands, line, nodes, total } = spec.curve(p);
  const FONT = "'InsightUI', Helvetica, Arial, sans-serif";
  const traces = [];
  for (const b of bands) traces.push({ x: b.xs, y: b.ys, mode: 'lines', line: { color: b.color, width: 40, shape: 'spline', smoothing: 1.3 }, hoverinfo: 'skip' });
  traces.push({ x: line.xs, y: line.ys, mode: 'lines', line: { color: '#7c7f92', width: 3, shape: 'spline', smoothing: 1.3 }, hoverinfo: 'skip' });
  traces.push({ x: nodes.xs, y: nodes.ys, mode: 'markers', marker: { color: '#7c7f92', size: 36 }, hoverinfo: 'skip' });

  const xmax = Math.max(total, 8);
  const xt = [0, 20, 40, 60, 80, 100].filter((v) => v <= xmax);
  const layout = {
    margin: { l: 120, r: 20, t: 34, b: 60 }, showlegend: false,
    paper_bgcolor: 'rgba(0,0,0,0)', plot_bgcolor: 'rgba(0,0,0,0)',
    xaxis: { range: [0, xmax], fixedrange: true, gridcolor: '#e6e6e6', gridwidth: 2, zeroline: false, showline: true, linecolor: '#c8c8d0', tickvals: xt, ticktext: xt.map((v) => (v === 0 ? 'start' : `${v} seconds`)), tickfont: { color: GREY, size: 30, family: FONT } },
    yaxis: { title: { text: spec.yLabel, font: { color: GREY, size: 32, family: FONT } }, range: [0, spec.yMax], fixedrange: true, gridcolor: '#e6e6e6', gridwidth: 2, zeroline: false, showline: true, linecolor: '#c8c8d0', tickvals: spec.yTicks, tickfont: { color: GREY, size: 30, family: FONT } },
  };
  try { window.Plotly.react(chartMount, traces, layout, { displayModeBar: false, staticPlot: true, responsive: true }); }
  catch (e) { logger.warn('pp chart', e); }
}

// Public: (re)render the editor for live._pp using `s` (PRESSURE_SPEC/FLOW_SPEC).
export function renderProfileEditor(host, live, s, onChange) {
  spec = s || PRESSURE_SPEC;
  let box = host.page.querySelector('.pp-editor');
  if (box && box.dataset.spec !== spec.id) { box.remove(); box = null; els = null; chartMount = null; }
  if (!box) { box = build(live, onChange); host.page.appendChild(box); }
  box.style.display = 'block';
  regen(live); refresh(live);
  setTimeout(() => { try { window.Plotly.Plots.resize(chartMount); } catch (e) { /* */ } }, 60);
}

export function hideProfileEditor(host) {
  const box = host && host.page.querySelector('.pp-editor');
  if (box) box.style.display = 'none';
}
export function removeProfileEditor(host) {
  const box = host && host.page.querySelector('.pp-editor');
  if (box) box.remove();
  els = null; chartMount = null;
}

// thermometer +/- : bump the main temp AND every step temp by d.
export function ppTempAdjust(live, d) {
  if (!live._pp) return;
  const p = live._pp;
  const clamp = (v) => Math.max(TEMP.min, Math.min(TEMP.max, v));
  p.temp = clamp((p.temp || 90) + d);
  p.temp1 = clamp((p.temp1 ?? p.temp) + d);
  p.temp2 = clamp((p.temp2 ?? p.temp) + d);
  p.temp3 = clamp((p.temp3 ?? p.temp) + d);
  p.temp0 = p.temp1;
  regen(live); refresh(live);
}

// tapping the thermometer body toggles per-step temperatures.
export function ppToggleTempSteps(live) {
  if (!live._pp) return;
  live._pp.tempSteps = !live._pp.tempSteps;
  if (live._pp.tempSteps) { const T = live._pp.temp; live._pp.temp0 = live._pp.temp1 = live._pp.temp2 = live._pp.temp3 = T; }
  regen(live); refresh(live);
}
