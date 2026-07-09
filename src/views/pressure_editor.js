// Faithful PRESSURE profile editor (Tcl settings_2a). Rendered as one overlay in
// 2560x1600 space over the baked settings_2a2 frame: an explanation chart with
// colour-banded target curve in the top box, and three step cards (preinfuse /
// rise&hold / decline) + a nested stop-at-weight card, each a set of custom
// grey-trough + coloured-thumb sliders at the exact Tcl coordinates.
import { LIMITS, buildPressureSteps, pressureCurve } from '../config/pressure_profile.js';
import { openNumpad } from './numpad.js';
import { t } from '../modules/i18n.js';
import { logger } from '../modules/logger.js';

// numpad ranges per editable param (Tcl dui_number_editor -min/-max/-smallincrement).
const EDIT = {
  time: { title: 'Time', min: 0, max: 60, step: 1, big: 10, dec: 0 },
  flow: { title: 'Flow rate', min: 1, max: 8, step: 0.1, big: 1, dec: 1 },
  stopPressure: { title: 'Pressure', min: 1, max: 12, step: 0.1, big: 1, dec: 1 },
  holdTime: { title: 'Time', min: 0, max: 60, step: 1, big: 10, dec: 0 },
  pressure: { title: 'Pressure', min: 1, max: 12, step: 0.1, big: 1, dec: 1 },
  maxFlow: { title: 'Flow rate', min: 0, max: 8, step: 0.1, big: 1, dec: 1 },
  declineTime: { title: 'Time', min: 0, max: 60, step: 1, big: 10, dec: 0 },
  pressureEnd: { title: 'Pressure', min: 1, max: 12, step: 0.1, big: 1, dec: 1 },
  weight: { title: 'Stop at weight', min: 1, max: 2000, step: 0.1, big: 10, dec: 1 },
  temp: { title: 'Temperature', min: 20, max: 105, step: 0.5, big: 5, dec: 1 },
  temp1: { title: 'Temperature', min: 20, max: 105, step: 0.5, big: 5, dec: 1 },
  temp2: { title: 'Temperature', min: 20, max: 105, step: 0.5, big: 5, dec: 1 },
  temp3: { title: 'Temperature', min: 20, max: 105, step: 0.5, big: 5, dec: 1 },
};
function editParam(live, key, onChange) {
  const e = EDIT[key]; if (!e) return;
  openNumpad({ title: t(e.title), value: live._pp[key], min: e.min, max: e.max, step: e.step, bigStep: e.big, decimals: e.dec,
    onOk: (v) => { live._pp[key] = v; regen(live); refresh(live); onChange(); } });
}

// stage colours (Tcl color_stage_1/2/3), sampled from the reference (s3) — soft
// pastels, not vivid.
const STAGE = { g: '#c8e7d5', t: '#efdec0', r: '#edcecb' };
const BLUE = '#4e85f4', GREY = '#7f879a';

// slider specs — key, orient, rect [x1,y1,x2,y2] in 2560-space, range, colour,
// and inv (vertical sliders run top=max -> bottom=0, like the Tcl -from max -to 0).
const SLIDERS = [
  { key: 'time', o: 'h', r: [47, 850, 647, 1000], lim: LIMITS.time, c: 'g' },
  { key: 'stopPressure', o: 'v', r: [670, 850, 820, 1320], lim: LIMITS.stopPressure, c: 'g', inv: true },
  { key: 'flow', o: 'h', r: [47, 1175, 647, 1325], lim: LIMITS.flow, c: 'g' },
  { key: 'holdTime', o: 'h', r: [892, 850, 1492, 1000], lim: LIMITS.time, c: 't' },
  { key: 'pressure', o: 'v', r: [1516, 850, 1666, 1320], lim: LIMITS.pressure, c: 't', inv: true },
  { key: 'maxFlow', o: 'h', r: [892, 1175, 1438, 1325], lim: LIMITS.maxFlow, c: 't' },
  { key: 'declineTime', o: 'h', r: [1730, 850, 2335, 1000], lim: LIMITS.time, c: 'r' },
  { key: 'pressureEnd', o: 'v', r: [2360, 850, 2510, 1320], lim: LIMITS.pressure, c: 'r', inv: true },
  { key: 'weight', o: 'h', r: [1730, 1175, 2276, 1325], lim: { min: 0, max: 2000, step: 0.2 }, c: 'r' },
];

// step titles + per-card value labels (blue) + temps
const TITLES = [
  { t: '1: preinfuse', x: 45, y: 755 },
  { t: '2: rise and hold', x: 890, y: 755 },
  { t: '3: decline', x: 1730, y: 755 },
  { t: 'Limit flow', x: 890, y: 1120, sm: true },
  { t: '4: stop at weight:', x: 1730, y: 1100 },
];
const n1 = (v) => (Number(v) || 0).toFixed(1);
const VALS = [
  { key: 'time', x: 47, y: 1000, a: 'nw', fmt: (p) => `< ${Math.round(p.time)} ${'seconds'}` },
  { key: 'flow', x: 47, y: 1325, a: 'nw', fmt: (p) => `${n1(p.flow)} mL/s` },
  { key: 'stopPressure', x: 820, y: 1325, a: 'ne', fmt: (p) => `< ${n1(p.stopPressure)} bar` },
  { key: 'holdTime', x: 892, y: 1000, a: 'nw', fmt: (p) => `${Math.round(p.holdTime)} seconds` },
  { key: 'pressure', x: 1667, y: 1325, a: 'ne', fmt: (p) => `${n1(p.pressure)} bar` },
  { key: 'maxFlow', x: 892, y: 1325, a: 'nw', fmt: (p) => (p.maxFlow > 0 ? `${n1(p.maxFlow)} mL/s` : 'off') },
  { key: 'declineTime', x: 1735, y: 1000, a: 'nw', fmt: (p) => `${Math.round(p.declineTime)} seconds` },
  { key: 'pressureEnd', x: 2510, y: 1325, a: 'ne', fmt: (p) => `${n1(p.pressureEnd)} bar` },
  { key: 'weight', x: 1730, y: 1325, a: 'nw', fmt: (p) => `${n1(p.weight)}g` },
];
const TEMPS = [{ x: 820, y: 760 }, { x: 1666, y: 760 }, { x: 2510, y: 760 }];

let els = null;      // cached DOM handles for cheap updates
let chartMount = null;

// Build (once) the overlay DOM; returns the container appended to host.page.
function build(host, live, onChange) {
  const box = document.createElement('div');
  box.className = 'pp-editor';
  // ---- chart mount (top box, left of the thermometer) ----
  chartMount = document.createElement('div');
  chartMount.className = 'pp-chart';
  box.appendChild(chartMount);

  // ---- titles ----
  for (const ti of TITLES) {
    const d = document.createElement('div');
    d.className = 'pp-title' + (ti.sm ? ' sm' : '');
    d.style.left = ti.x + 'px'; d.style.top = ti.y + 'px';
    d.textContent = ti.t;
    box.appendChild(d);
  }
  // ---- value labels (blue) — each taps to the full-page numpad ----
  const valEls = {};
  for (const v of VALS) {
    const d = document.createElement('div');
    d.className = 'pp-val ' + v.a;
    d.style.left = v.x + 'px'; d.style.top = v.y + 'px';
    d.addEventListener('click', () => editParam(live, v.key, onChange));
    box.appendChild(d);
    valEls[v.key] = { el: d, fmt: v.fmt };
  }
  // ---- per-card temperature (blue, top-right of each card) — steps mode only;
  // tap each to edit that step's temperature via the numpad. ----
  const tempKeys = ['temp1', 'temp2', 'temp3'];
  const tempEls = TEMPS.map((tp, i) => {
    const d = document.createElement('div');
    d.className = 'pp-temp ne';
    d.style.left = tp.x + 'px'; d.style.top = tp.y + 'px';
    d.addEventListener('click', () => { if (live._pp.tempSteps) editParam(live, tempKeys[i], onChange); });
    box.appendChild(d); return d;
  });
  // ---- main thermometer temperature (below the baked bulb) ----
  const mainTemp = document.createElement('div');
  mainTemp.className = 'pp-maintemp';
  box.appendChild(mainTemp);

  // ---- sliders ----
  const sliderEls = {};
  for (const s of SLIDERS) {
    const [x1, y1, x2, y2] = s.r;
    const sl = document.createElement('div');
    sl.className = `pp-slider ${s.o} stage-${s.c}`;
    Object.assign(sl.style, { left: x1 + 'px', top: y1 + 'px', width: (x2 - x1) + 'px', height: (y2 - y1) + 'px' });
    const thumb = document.createElement('div');
    thumb.className = 'pp-thumb';
    sl.appendChild(thumb);
    box.appendChild(sl);
    sliderEls[s.key] = { root: sl, thumb, spec: s };
    attachDrag(sl, s, live, onChange);
  }

  els = { valEls, tempEls, mainTemp, sliderEls };
  return box;
}

// Map a pointer position to a value and commit it live.
function attachDrag(sl, spec, live, onChange) {
  const setFromEvent = (ev) => {
    const rect = sl.getBoundingClientRect();
    let frac;
    if (spec.o === 'h') frac = (ev.clientX - rect.left) / rect.width;
    else frac = (ev.clientY - rect.top) / rect.height;
    frac = Math.max(0, Math.min(1, frac));
    if (spec.inv) frac = 1 - frac;                 // vertical: top = max
    const { min, max, step } = spec.lim;
    let val = min + frac * (max - min);
    val = Math.round(val / step) * step;
    val = Math.max(min, Math.min(max, val));
    live._pp[spec.key] = val;
    regen(live);
    refresh(live);
    onChange();
  };
  let dragging = false;
  const down = (ev) => { dragging = true; sl.setPointerCapture?.(ev.pointerId); setFromEvent(ev); ev.preventDefault(); };
  const move = (ev) => { if (dragging) setFromEvent(ev); };
  const up = (ev) => { dragging = false; try { sl.releasePointerCapture?.(ev.pointerId); } catch (e) { /* */ } };
  sl.addEventListener('pointerdown', down);
  sl.addEventListener('pointermove', move);
  sl.addEventListener('pointerup', up);
  sl.addEventListener('pointercancel', up);
}

// Regenerate the working profile's steps from the simple params.
function regen(live) {
  if (!live._advProfile) live._advProfile = { steps: [] };
  live._advProfile.steps = buildPressureSteps(live._pp);
}

// Update all labels, slider thumbs, and the chart from live._pp.
function refresh(live) {
  if (!els) return;
  const p = live._pp;
  for (const k in els.valEls) els.valEls[k].el.textContent = els.valEls[k].fmt(p);
  // per-card temps only appear in steps mode (Tcl returns "" when disabled)
  if (p.tempSteps) {
    els.tempEls[0].textContent = `${Math.round(p.temp1)}°C`;   // preinfusion: one temperature
    els.tempEls[1].textContent = `${Math.round(p.temp2)}°C`;
    els.tempEls[2].textContent = `${Math.round(p.temp3)}°C`;
  } else {
    els.tempEls.forEach((d) => { d.textContent = ''; });
  }
  els.mainTemp.textContent = `${Math.round(p.temp)}°C`;
  for (const k in els.sliderEls) {
    const { thumb, spec } = els.sliderEls[k];
    const { min, max } = spec.lim;
    let frac = (p[k] - min) / (max - min || 1);
    frac = Math.max(0, Math.min(1, frac));
    if (spec.inv) frac = 1 - frac;
    // thumb travels from 0 to (track - thumb); position by its leading edge
    if (spec.o === 'h') thumb.style.left = `calc(${frac} * (100% - var(--pp-thumb)))`;
    else thumb.style.top = `calc(${frac} * (100% - var(--pp-thumb)))`;
  }
  drawChart(p);
}

function drawChart(p) {
  if (!chartMount || !window.Plotly) return;
  const { bands, line, nodes, total } = pressureCurve(p);
  const FONT = "'InsightUI', Helvetica, Arial, sans-serif";
  const traces = [];
  // colour bands: fat soft-coloured stroke per stage (own point array, so the
  // green stops exactly at its node instead of bleeding into the tan rise).
  for (const b of bands) traces.push({ x: b.xs, y: b.ys, mode: 'lines', line: { color: b.color, width: 40, shape: 'spline', smoothing: 1.3 }, hoverinfo: 'skip' });
  // thin dark target line over the whole curve, plus node dots at boundaries
  traces.push({ x: line.xs, y: line.ys, mode: 'lines', line: { color: '#7c7f92', width: 3, shape: 'spline', smoothing: 1.3 }, hoverinfo: 'skip' });
  traces.push({ x: nodes.xs, y: nodes.ys, mode: 'markers', marker: { color: '#7c7f92', size: 36 }, hoverinfo: 'skip' });

  const xmax = Math.max(total, 8);   // fit the axis to the data so the line reaches the right edge
  const xt = [0, 20, 40, 60, 80, 100].filter((v) => v <= xmax);
  const layout = {
    margin: { l: 120, r: 20, t: 34, b: 60 }, showlegend: false,
    paper_bgcolor: 'rgba(0,0,0,0)', plot_bgcolor: 'rgba(0,0,0,0)',
    xaxis: { range: [0, xmax], fixedrange: true, gridcolor: '#e6e6e6', gridwidth: 2, zeroline: false, showline: true, linecolor: '#c8c8d0', tickvals: xt, ticktext: xt.map((v) => (v === 0 ? 'start' : `${v} seconds`)), tickfont: { color: GREY, size: 30, family: FONT } },
    yaxis: { title: { text: 'pressure (bar)', font: { color: GREY, size: 32, family: FONT } }, range: [0, 12.4], fixedrange: true, gridcolor: '#e6e6e6', gridwidth: 2, zeroline: false, showline: true, linecolor: '#c8c8d0', tickvals: [1, 3, 5, 7, 9, 11], tickfont: { color: GREY, size: 30, family: FONT } },
  };
  try { window.Plotly.react(chartMount, traces, layout, { displayModeBar: false, staticPlot: true, responsive: true }); }
  catch (e) { logger.warn('pp chart', e); }
}

// Public: (re)render the editor for the current live._pp. Called from settings.js
// when settings_2a is shown in pressure-edit mode.
export function renderPressureEditor(host, live, onChange) {
  let box = host.page.querySelector('.pp-editor');
  if (!box) { box = build(host, live, onChange); host.page.appendChild(box); }
  box.style.display = 'block';
  regen(live);
  refresh(live);
  // Plotly needs a resize once it is visible + laid out.
  setTimeout(() => { try { window.Plotly.Plots.resize(chartMount); } catch (e) { /* */ } }, 60);
}

export function hidePressureEditor(host) {
  const box = host && host.page.querySelector('.pp-editor');
  if (box) box.style.display = 'none';
}

export function removePressureEditor(host) {
  const box = host && host.page.querySelector('.pp-editor');
  if (box) box.remove();
  els = null; chartMount = null;
}

// temp +/- from the baked thermometer buttons: bump the main temp AND every
// step's temperature by d (so it works in both simple and per-step modes, and
// per-step differences are preserved).
export function ppTempAdjust(live, d) {
  if (!live._pp) return;
  const p = live._pp;
  const clamp = (v) => Math.max(LIMITS.temp.min, Math.min(LIMITS.temp.max, v));
  p.temp = clamp((p.temp || 90) + d);
  p.temp1 = clamp((p.temp1 ?? p.temp) + d);
  p.temp2 = clamp((p.temp2 ?? p.temp) + d);
  p.temp3 = clamp((p.temp3 ?? p.temp) + d);
  p.temp0 = p.temp1;
  regen(live); refresh(live);
}

// Tapping the thermometer body toggles per-step temperatures (Tcl
// toggle_espresso_steps_option): on enable, seed all four step temps to the main.
export function ppToggleTempSteps(live) {
  if (!live._pp) return;
  live._pp.tempSteps = !live._pp.tempSteps;
  if (live._pp.tempSteps) { const T = live._pp.temp; live._pp.temp0 = live._pp.temp1 = live._pp.temp2 = live._pp.temp3 = T; }
  regen(live); refresh(live);
}
