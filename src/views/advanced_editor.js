// Faithful ADVANCED profile editor (Tcl settings_2c Steps + settings_2c2 Limits).
// Unlike the pressure/flow editors this works DIRECTLY on the profile's steps[]
// (each step is a full advanced frame). Rendered as an overlay in 2560x1600 over
// the baked settings_2c / settings_2c2 frames. Two sub-tabs (Steps / Limits).
import { openNumpad } from './numpad.js';
import { openModal, closeModal } from '../modules/overlay.js';
import { MiniChart } from '../modules/chart.js';
import { t } from '../modules/i18n.js';
import { logger } from '../modules/logger.js';

const BLUE = '#4e85f4', GREY = '#7f879a';

// beverage types (Tcl bevtype2desc_list) + the "<X> steps" heading per type
// (Tcl bevtype2stepdesc). Tapping the heading opens the chooser (Tcl "bev_type").
const BEVTYPES = [
  ['espresso', 'Espresso'], ['pourover', 'Pour over'], ['filter', 'Filter coffee'],
  ['tea_portafilter', 'Tea portafilter'], ['tea', 'Tea'], ['calibrate', 'Calibration'],
  ['cleaning', 'Cleaning'], ['manual', 'Manual'],
];
const BEV_STEPDESC = {
  calibrate: 'Calibration steps', cleaning: 'Cleaning steps', espresso: 'Espresso steps',
  filter: 'Filter coffee steps', manual: 'Manual steps', pourover: 'Pour over steps',
  tea: 'Tea steps', tea_portafilter: 'Tea portafilter steps',
};
const n1 = (v) => (Number(v) || 0).toFixed(1);
const r0 = (v) => Math.round(Number(v) || 0);
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const round1 = (v) => Math.round(v * 10) / 10;

// A blank step (used by "add").
const NEW_STEP = () => ({ name: 'new step', temperature: 90, sensor: 'coffee', pump: 'flow', transition: 'fast', pressure: 6, flow: 2, seconds: 10, volume: 0, weight: 0, exit_if: 0, exit_type: 'pressure_over', exit_pressure_over: 11, exit_pressure_under: 0, exit_flow_over: 6, exit_flow_under: 0, max_flow_or_pressure: 0, popup: '' });

// ---- card titles (grey) ----
const TITLES = [
  { x: 984, y: 240, t: () => '1: Temperature' },
  { x: 1600, y: 240, t: (s) => (s.pump === 'flow' ? '2: Flow rate goal' : '2: Pressure goal') },
  { x: 984, y: 830, t: () => '3: Maximum' },
  { x: 1740, y: 830, t: () => '4: Move on if…' },   // nudged right, clear of the on/off switch
];

// ---- small grey sub-labels + blue value labels per control ----
// cx = centre x; subY / valY are the two rows (both centred on their y, matching
// Tcl anchor "center"). zones = +/- tap targets. np = numpad tap rect + tap()
// returns the numpad spec (field/min/max/decimals) for that blue number.
const CTRL = [
  // card 1
  { cx: 1070, subY: 680, valY: 744, sub: () => 'goal', val: (s) => `${r0(s.temperature)}°C`,
    zones: [{ r: [980, 310, 1150, 475], act: 'tempUp' }, { r: [980, 475, 1150, 640], act: 'tempDown' }],
    np: [980, 650, 1150, 780], tap: () => ({ title: 'Temperature', field: 'temperature', min: 0, max: 105, dec: 1, step: 0.5, bigStep: 10 }) },
  { cx: 1380, subY: 680, valY: 744, sub: () => 'sensor', val: (s) => t(s.sensor || 'coffee'),
    zones: [{ r: [1200, 310, 1550, 680], act: 'sensor' }] },
  // card 2
  { cx: 1710, subY: 680, valY: 744, sub: (s) => (s.pump === 'flow' ? 'flow' : 'flow limit'),
    val: (s) => (s.pump === 'flow' ? `${n1(s.flow)} mL/s` : (s.max_flow_or_pressure > 0 ? `${n1(s.max_flow_or_pressure)} mL/s` : 'off')),
    zones: [{ r: [1580, 310, 1820, 410], act: 'flowUp' }, { r: [1580, 430, 1820, 520], act: 'pumpFlow' }, { r: [1580, 540, 1820, 640], act: 'flowDown' }],
    np: [1580, 650, 1820, 780], tap: (s) => (s.pump === 'flow'
      ? { title: 'Flow rate goal', field: 'flow', min: 0, max: 8, dec: 1, step: 1, bigStep: 2 }
      : { title: 'Flow limit', field: 'max_flow_or_pressure', min: 0, max: 8, dec: 1, step: 1, bigStep: 2 }) },
  { cx: 2010, subY: 680, valY: 744, sub: (s) => (s.pump === 'pressure' ? 'pressure' : 'pressure limit'),
    val: (s) => (s.pump === 'pressure' ? `${n1(s.pressure)} bar` : (s.max_flow_or_pressure > 0 ? `${n1(s.max_flow_or_pressure)} bar` : 'off')),
    zones: [{ r: [1890, 310, 2120, 410], act: 'pressUp' }, { r: [1890, 430, 2120, 520], act: 'pumpPress' }, { r: [1890, 540, 2120, 640], act: 'pressDown' }],
    np: [1890, 650, 2120, 780], tap: (s) => (s.pump === 'pressure'
      ? { title: 'Pressure goal', field: 'pressure', min: 0, max: 12, dec: 1, step: 1, bigStep: 5 }
      : { title: 'Pressure limit', field: 'max_flow_or_pressure', min: 0, max: 12, dec: 1, step: 1, bigStep: 2 }) },
  { cx: 2345, subY: 680, valY: 744, sub: () => 'transition', val: (s) => t(s.transition || 'fast'),
    zones: [{ r: [2200, 310, 2500, 680], act: 'transition' }] },
  // card 3
  { cx: 1060, subY: 1270, valY: 1340, sub: () => 'time', val: (s) => `${r0(s.seconds)} sec`,
    zones: [{ r: [960, 900, 1140, 1070], act: 'secUp' }, { r: [960, 1070, 1140, 1240], act: 'secDown' }],
    np: [960, 1250, 1140, 1380], tap: () => ({ title: 'Time', field: 'seconds', min: 0, max: 127, dec: 0, step: 1, bigStep: 10 }) },
  { cx: 1260, subY: 1270, valY: 1340, sub: () => 'volume', val: (s) => (s.volume > 0 ? `${r0(s.volume)} mL` : 'off'),
    zones: [{ r: [1144, 900, 1344, 1070], act: 'volUp' }, { r: [1144, 1070, 1344, 1240], act: 'volDown' }],
    np: [1144, 1250, 1344, 1380], tap: () => ({ title: 'Volume', field: 'volume', min: 0, max: 1023, dec: 0, step: 1, bigStep: 10 }) },
  { cx: 1450, subY: 1270, valY: 1340, sub: () => 'weight', val: (s) => (s.weight > 0 ? `${n1(s.weight)}g` : 'off'),
    zones: [{ r: [1354, 900, 1540, 1070], act: 'wtUp' }, { r: [1354, 1070, 1540, 1240], act: 'wtDown' }],
    np: [1354, 1250, 1540, 1380], tap: () => ({ title: 'Weight', field: 'weight', min: 0, max: 1000, dec: 1, step: 0.1, bigStep: 10 }) },
  // card 4 — exit conditions (two-line sub). Tapping the number sets the exit type + enables it.
  { cx: 1700, subY: 1240, sub2Y: 1274, valY: 1340, sub: () => 'pressure', sub2: () => 'is over',
    val: (s) => ((s.exit_if && s.exit_type === 'pressure_over') ? `${n1(s.exit_pressure_over)} bar` : '-'),
    zones: [{ r: [1580, 900, 1780, 1070], act: 'exPOup' }, { r: [1580, 1070, 1780, 1240], act: 'exPOdn' }],
    np: [1580, 1250, 1780, 1380], tap: () => ({ title: 'Pressure is over', field: 'exit_pressure_over', min: 0, max: 11, dec: 1, step: 0.1, bigStep: 1, exitType: 'pressure_over' }) },
  { cx: 1930, subY: 1240, sub2Y: 1274, valY: 1340, sub: () => 'pressure', sub2: () => 'is under',
    val: (s) => ((s.exit_if && s.exit_type === 'pressure_under') ? `${n1(s.exit_pressure_under)} bar` : '-'),
    zones: [{ r: [1790, 900, 2010, 1070], act: 'exPUup' }, { r: [1790, 1070, 2010, 1240], act: 'exPUdn' }],
    np: [1790, 1250, 2010, 1380], tap: () => ({ title: 'Pressure is under', field: 'exit_pressure_under', min: 0, max: 11, dec: 1, step: 0.1, bigStep: 1, exitType: 'pressure_under' }) },
  { cx: 2154, subY: 1240, sub2Y: 1274, valY: 1340, sub: () => 'flow', sub2: () => 'is over',
    val: (s) => ((s.exit_if && s.exit_type === 'flow_over') ? `${n1(s.exit_flow_over)} mL/s` : '-'),
    zones: [{ r: [2020, 900, 2260, 1070], act: 'exFOup' }, { r: [2020, 1070, 2260, 1240], act: 'exFOdn' }],
    np: [2020, 1250, 2260, 1380], tap: () => ({ title: 'Flow is over', field: 'exit_flow_over', min: 0, max: 6, dec: 1, step: 0.1, bigStep: 1, exitType: 'flow_over' }) },
  { cx: 2388, subY: 1240, sub2Y: 1274, valY: 1340, sub: () => 'flow', sub2: () => 'is under',
    val: (s) => ((s.exit_if && s.exit_type === 'flow_under') ? `${n1(s.exit_flow_under)} mL/s` : '-'),
    zones: [{ r: [2270, 900, 2500, 1070], act: 'exFUup' }, { r: [2270, 1070, 2500, 1240], act: 'exFUdn' }],
    np: [2270, 1250, 2500, 1380], tap: () => ({ title: 'Flow is under', field: 'exit_flow_under', min: 0, max: 6, dec: 1, step: 0.1, bigStep: 1, exitType: 'flow_under' }) },
];

// extra tap zones: trash, add, move-on-if toggle, tab buttons
const EXTRA_ZONES = [
  { r: [740, 250, 920, 500], act: 'delete' },
  { r: [740, 750, 920, 950], act: 'add' },
  { r: [1580, 820, 2200, 895], act: 'toggleExit' },
];

let host, live, onChange, els;

function cur() { return (live._advProfile.steps || [])[live._advSel] || {}; }

// ---- action handlers (mutate the current step / selection) ----
function bump(field, d, lo, hi) { const s = cur(); s[field] = clamp(round1((Number(s[field]) || 0) + d), lo, hi); }
const ACTIONS = {
  tempUp: () => bump('temperature', 1, 0, 105), tempDown: () => bump('temperature', -1, 0, 105),
  sensor: () => { const s = cur(); s.sensor = s.sensor === 'water' ? 'coffee' : 'water'; },
  transition: () => { const s = cur(); s.transition = s.transition === 'fast' ? 'smooth' : 'fast'; },
  pumpFlow: () => { cur().pump = 'flow'; }, pumpPress: () => { cur().pump = 'pressure'; },
  flowUp: () => { const s = cur(); s.pump === 'flow' ? bump('flow', 0.1, 0, 8) : bump('max_flow_or_pressure', 0.1, 0, 8); },
  flowDown: () => { const s = cur(); s.pump === 'flow' ? bump('flow', -0.1, 0, 8) : bump('max_flow_or_pressure', -0.1, 0, 8); },
  pressUp: () => { const s = cur(); s.pump === 'pressure' ? bump('pressure', 0.1, 0, 12) : bump('max_flow_or_pressure', 0.1, 0, 12); },
  pressDown: () => { const s = cur(); s.pump === 'pressure' ? bump('pressure', -0.1, 0, 12) : bump('max_flow_or_pressure', -0.1, 0, 12); },
  secUp: () => bump('seconds', 1, 0, 127), secDown: () => bump('seconds', -1, 0, 127),
  volUp: () => bump('volume', 1, 0, 1023), volDown: () => bump('volume', -1, 0, 1023),
  wtUp: () => bump('weight', 1, 0, 1000), wtDown: () => bump('weight', -1, 0, 1000),
  toggleExit: () => { const s = cur(); s.exit_if = s.exit_if ? 0 : 1; },
  add: () => { const steps = live._advProfile.steps; const s = { ...NEW_STEP(), ...structuredClone(cur()), name: 'new step' }; steps.splice(live._advSel + 1, 0, s); live._advSel += 1; },
  delete: () => { const steps = live._advProfile.steps; if (steps.length > 1) { steps.splice(live._advSel, 1); live._advSel = Math.max(0, live._advSel - 1); } },
};
// exit-condition taps: first tap selects the exit type (+enables); further taps nudge the value.
function exitTap(type, field, d, lo, hi) {
  const s = cur();
  if (!s.exit_if || s.exit_type !== type) { s.exit_if = 1; s.exit_type = type; }
  else bump(field, d, lo, hi);
}
ACTIONS.exPOup = () => exitTap('pressure_over', 'exit_pressure_over', 0.1, 0, 13);
ACTIONS.exPOdn = () => exitTap('pressure_over', 'exit_pressure_over', -0.1, 0, 13);
ACTIONS.exPUup = () => exitTap('pressure_under', 'exit_pressure_under', 0.1, 0, 13);
ACTIONS.exPUdn = () => exitTap('pressure_under', 'exit_pressure_under', -0.1, 0, 13);
ACTIONS.exFOup = () => exitTap('flow_over', 'exit_flow_over', 0.1, 0, 6);
ACTIONS.exFOdn = () => exitTap('flow_over', 'exit_flow_over', -0.1, 0, 6);
ACTIONS.exFUup = () => exitTap('flow_under', 'exit_flow_under', 0.1, 0, 6);
ACTIONS.exFUdn = () => exitTap('flow_under', 'exit_flow_under', -0.1, 0, 6);

function doAction(act) {
  const fn = ACTIONS[act]; if (!fn) return;
  fn(); refresh(); onChange();
}

// ---- build the DOM once ----
function zone(r, act) {
  const d = document.createElement('div');
  d.className = 'adv-zone';
  d.style.cssText = `left:${r[0]}px;top:${r[1]}px;width:${r[2] - r[0]}px;height:${r[3] - r[1]}px`;
  d.addEventListener('click', () => doAction(act));
  return d;
}
function zoneFn(r, fn) {
  const d = document.createElement('div');
  d.className = 'adv-zone';
  d.style.cssText = `left:${r[0]}px;top:${r[1]}px;width:${r[2] - r[0]}px;height:${r[3] - r[1]}px`;
  d.addEventListener('click', fn);
  return d;
}
function label(cls, x, y) {
  const d = document.createElement('div'); d.className = cls; d.style.left = x + 'px'; d.style.top = y + 'px';
  return d;
}

// ---- tap a blue number -> full-screen data entry (Tcl dui_number_editor) ----
function doNumpad(c) {
  const s = cur();
  const o = c.tap && c.tap(s); if (!o) return;
  const v = Number(s[o.field]) || 0;
  openNumpad({
    title: t(o.title), value: o.dec ? n1(v) : String(r0(v)),
    min: o.min, max: o.max, step: o.step || (o.dec ? 0.1 : 1), bigStep: o.bigStep || 1, decimals: o.dec, unit: o.unit || '',
    onOk: (nv) => { if (o.exitType) { s.exit_if = 1; s.exit_type = o.exitType; } s[o.field] = nv; refresh(); onChange(); },
  });
}

// ---- "<X> steps" heading + beverage-type chooser (Tcl "bev_type" page) ----
function stepDesc() { const b = live._advProfile.beverage_type || 'espresso'; return t(BEV_STEPDESC[b] || 'Espresso steps'); }
function openBevChooser() {
  let sel = live._advProfile.beverage_type || 'espresso';
  const el = (tag, css, txt) => { const n = document.createElement(tag); if (css) n.style.cssText = css; if (txt != null) n.textContent = txt; return n; };
  const root = el('div', 'position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;background:#eef0f7;font-family:\'InsightUI\',Helvetica,Arial,sans-serif;-webkit-font-smoothing:antialiased;');
  root.appendChild(el('div', 'margin-top:34px;font-size:42px;font-weight:700;color:#444;', t('Beverage type')));
  root.appendChild(el('div', 'margin:22px 0 6px;font-size:30px;font-weight:700;color:#444;text-align:center;max-width:60%;', t('What kind of beverage is this profile making?')));
  const listWrap = el('div', 'flex:1;min-height:0;overflow-y:auto;display:flex;flex-direction:column;gap:14px;padding:18px 0;width:520px;');
  const rows = BEVTYPES.map(([k, lbl]) => {
    const b = el('button', 'padding:22px;border:2px solid #dfe1ec;border-radius:12px;font-size:34px;cursor:pointer;text-align:center;background:#FAFAFA;color:#42465c;', t(lbl));
    const paint = () => { const on = sel === k; b.style.background = on ? '#4d85f4' : '#FAFAFA'; b.style.color = on ? '#fff' : '#42465c'; b.style.borderColor = on ? '#4d85f4' : '#dfe1ec'; };
    b.addEventListener('click', () => { sel = k; rows.forEach((r) => r.paint()); });
    b.paint = paint; paint();
    listWrap.appendChild(b);
    return b;
  });
  root.appendChild(listWrap);
  const ok = el('button', 'margin:10px 0 30px;width:600px;height:120px;border:none;border-radius:14px;background:#c9cef0;color:#42465c;font-size:34px;cursor:pointer;', t('Ok'));
  ok.addEventListener('click', () => { live._advProfile.beverage_type = sel; refresh(); onChange(); closeModal(); });
  root.appendChild(ok);
  openModal(root);
}

function buildSteps(box) {
  const wrap = document.createElement('div'); wrap.className = 'adv-steps';
  // step list
  const list = document.createElement('div'); list.className = 'adv-list'; wrap.appendChild(list);
  // title + message inputs (bold field labels, matching Tcl Helv_7_bold)
  const titleL = label('adv-sublabel b', 70, 792); titleL.textContent = t('Title'); wrap.appendChild(titleL);
  const msgL = label('adv-sublabel b', 490, 792); msgL.textContent = t('Message'); wrap.appendChild(msgL);
  const titleI = document.createElement('input'); titleI.className = 'adv-input'; titleI.style.cssText = 'left:70px;top:840px;width:380px';
  titleI.addEventListener('input', () => { cur().name = titleI.value; renderList(); onChange(); });
  wrap.appendChild(titleI);
  const msgI = document.createElement('input'); msgI.className = 'adv-input'; msgI.style.cssText = 'left:490px;top:840px;width:210px';
  msgI.addEventListener('input', () => { cur().popup = msgI.value; onChange(); });
  wrap.appendChild(msgI);
  // preview chart (same MiniChart as the presets-page preview)
  const chart = document.createElement('div'); chart.className = 'adv-chart'; wrap.appendChild(chart);
  // "<X> steps" heading — tappable to choose the beverage type (Tcl bev_type)
  const heading = label('adv-heading', 70, 236); heading.textContent = stepDesc(); wrap.appendChild(heading);
  wrap.appendChild(zoneFn([0, 200, 700, 300], openBevChooser));
  // card titles
  const titleEls = TITLES.map((ti) => { const d = label('adv-cardtitle', ti.x, ti.y); wrap.appendChild(d); return d; });
  // sub-labels + values
  const valEls = CTRL.map((c) => {
    const sub = label('adv-sublabel c', c.cx, c.subY); wrap.appendChild(sub);
    let sub2 = null;
    if (c.sub2) { sub2 = label('adv-sublabel c', c.cx, c.sub2Y); wrap.appendChild(sub2); }
    const val = label('adv-value c', c.cx, c.valY); wrap.appendChild(val);
    return { c, sub, sub2, val };
  });
  // move-on-if toggle (visual)
  const toggle = document.createElement('div'); toggle.className = 'adv-toggle'; toggle.style.cssText = 'left:1600px;top:845px'; wrap.appendChild(toggle);
  // tap zones: +/- steppers, extras, and one numpad zone per numeric control
  for (const c of CTRL) for (const z of c.zones) wrap.appendChild(zone(z.r, z.act));
  for (const z of EXTRA_ZONES) wrap.appendChild(zone(z.r, z.act));
  for (const c of CTRL) if (c.np) wrap.appendChild(zoneFn(c.np, () => doNumpad(c)));

  els = { wrap, list, titleI, msgI, chart, heading, titleEls, valEls, toggle, mini: null };
  return wrap;
}

function renderList() {
  els.list.innerHTML = '';
  (live._advProfile.steps || []).forEach((s, i) => {
    const row = document.createElement('div');
    row.className = 'adv-listrow' + (i === live._advSel ? ' sel' : '');
    row.textContent = `${i + 1}. ${s.name || s.pump || 'step'}`;
    row.addEventListener('click', () => { live._advSel = i; refresh(); });
    els.list.appendChild(row);
  });
}

function refresh() {
  if (!els) return;
  const s = cur();
  els.heading.textContent = stepDesc();
  renderList();
  els.titleI.value = s.name || '';
  els.msgI.value = s.popup || '';
  els.titleEls.forEach((d, i) => { d.textContent = t(TITLES[i].t(s)); });
  els.valEls.forEach(({ c, sub, sub2, val }) => {
    sub.textContent = t(c.sub(s));
    if (sub2) sub2.textContent = t(c.sub2(s));
    val.textContent = c.val(s);
  });
  els.toggle.classList.toggle('on', !!s.exit_if);
  drawChart();
}

// Preview buffer from steps[] (JS port of settings.js presetPreviewBuf): target
// pressure/flow/temp over cumulative time, with smooth-transition handoffs, so the
// advanced preview reads exactly like the presets-page MiniChart.
function advPreviewBuf(steps) {
  const out = { t: [], p: [], f: [], temp: [], w: [] };
  if (!Array.isArray(steps)) return out;
  const pushT = (temp) => out.temp.push(temp != null ? +temp / 10 : null);
  const draw = []; let sp = null, sf = null;
  for (const s of steps) {
    const dur = Math.max(0, +s.seconds || 0);
    if (dur === 0) { if (s.pump === 'pressure') sp = +s.pressure; else sf = +s.flow; continue; }
    draw.push({ s, dur });
  }
  let clock = 0, prevP = sp, prevF = sf;
  for (let i = 0; i < draw.length; i++) {
    const { s, dur } = draw[i], prev = draw[i - 1], next = draw[i + 1];
    const smooth = s.transition === 'smooth', handoffIn = prev && prev.s.pump !== s.pump, temp = +s.temperature;
    // A smooth ramp only inherits the *previous drawn* value when the previous step
    // used the same pump. Across a pump handoff there's a gap, so start fresh at v —
    // otherwise a later flow step would ramp from a stale earlier flow value, and
    // editing one step's flow would visibly move unrelated flow steps.
    if (s.pump === 'pressure') {
      const v = +s.pressure, from = smooth && prevP != null && !handoffIn ? prevP : v;
      if (handoffIn) { out.t.push(clock); out.p.push(0); out.f.push(null); pushT(temp); }
      out.t.push(clock, clock + dur); out.p.push(from, v); out.f.push(null, null); pushT(temp); pushT(temp);
      prevP = v;
      if (next && next.s.pump !== 'pressure') { out.t.push(clock + dur); out.p.push(0); out.f.push(null); pushT(temp); }
    } else {
      const v = +s.flow, from = smooth && prevF != null && !handoffIn ? prevF : v;
      if (handoffIn) { out.t.push(clock); out.f.push(0); out.p.push(null); pushT(temp); }
      out.t.push(clock, clock + dur); out.f.push(from, v); out.p.push(null, null); pushT(temp); pushT(temp);
      prevF = v;
      if (next && next.s.pump !== 'flow') { out.t.push(clock + dur); out.f.push(0); out.p.push(null); pushT(temp); }
    }
    clock += dur;
  }
  return out;
}
function drawChart() {
  if (!els || !window.Plotly) return;
  try {
    if (!els.mini) {
      els.mini = new MiniChart(els.chart, { series: [{ key: 'p', color: '#00b672' }, { key: 'f', color: '#6c9bff' }, { key: 'temp', color: '#ff7880' }] });
      // fixed 0-12 y-axis + even margins: while editing one step, the rest of the
      // curve must hold still (autorange would rescale the whole chart on any change).
      els.mini.layout.yaxis.autorange = false; els.mini.layout.yaxis.range = [0, 12]; els.mini.layout.yaxis.tickvals = [2, 4, 6, 8, 10, 12];
      els.mini.layout.yaxis.ticklabelstandoff = 5;   // nudge the y-labels ~2px left of the axis
      els.mini.layout.margin = { l: 70, r: 40, t: 34, b: 50 };
    }
    els.mini.render(advPreviewBuf(live._advProfile.steps || []));
  } catch (e) { logger.warn('adv chart', e); }
}

// ---- Limits tab (settings_2c2) ----
// ty = grey title y, sy = slider top y, vy = blue value y (BELOW the slider so it
// doesn't overlap). Coordinates match the Tcl settings_2c2 layout exactly. The
// blue value is tappable -> full-screen numpad (like the Tcl dui_number_editor).
const LIMITS = [
  { key: 'tank_temperature', title: 'Preheat water tank', x: 70, w: 2400, ty: 230, sy: 300, vy: 420,
    min: 0, max: 45, step: 1, bigStep: 10, dec: 0, unit: '°C', c: 't', fmt: (v) => (v > 0 ? `${r0(v)}°C` : t('off')) },
  { key: 'target_volume_count_start', title: 'Preinfusion ends after:', x: 70, w: 800, ty: 530, sy: 600, vy: 720,
    min: 0, max: 10, step: 1, bigStep: 1, dec: 0, unit: '', c: 't', special: 'countStart', grey: true },
  { key: 'target_volume', title: 'After preinfusion, stop the shot at:', x: 970, w: 1500, ty: 530, sy: 600, vy: 720,
    min: 0, max: 2000, step: 1, bigStep: 10, dec: 0, unit: 'mL', c: 't', fmt: (v) => (v > 0 ? `${r0(v)} mL` : t('off')) },
  { key: 'maximum_flow_range_advanced', title: 'Limit flow range', x: 70, w: 700, ty: 830, sy: 900, vy: 1020,
    min: 0.1, max: 8, step: 0.1, bigStep: 1, dec: 1, unit: 'mL/s', c: 't', fmt: (v) => `${n1(v)} mL/s` },
  { key: 'maximum_pressure_range_advanced', title: 'Limit pressure range', x: 800, w: 700, ty: 830, sy: 900, vy: 1020,
    min: 0.1, max: 8, step: 0.1, bigStep: 1, dec: 1, unit: 'bar', c: 't', fmt: (v) => `${n1(v)} bar` },
  { key: 'target_weight', title: 'Stop at weight', x: 70, w: 2400, ty: 1130, sy: 1200, vy: 1320,
    min: 0, max: 2000, step: 0.2, bigStep: 1, dec: 1, unit: 'g', c: 't', fmt: (v) => `${n1(v)}g` },
];
let limitEls;
function limVal(key) {
  const p = live._advProfile;
  if (key === 'maximum_flow_range_advanced') return Number((p.steps || []).find((s) => s.max_flow_or_pressure_range > 0)?.max_flow_or_pressure_range) || 0.6;
  if (key === 'maximum_pressure_range_advanced') return Number((p.steps || []).find((s) => s.max_flow_or_pressure_range > 0)?.max_flow_or_pressure_range) || 0.9;
  return Number(p[key]) || 0;
}
function limSet(key, v) {
  const p = live._advProfile;
  if (key === 'maximum_flow_range_advanced' || key === 'maximum_pressure_range_advanced') { (p.steps || []).forEach((s) => { if (s.max_flow_or_pressure > 0) s.max_flow_or_pressure_range = v; }); }
  else p[key] = v;
}
function buildLimits(box) {
  const wrap = document.createElement('div'); wrap.className = 'adv-limits';
  limitEls = LIMITS.map((L) => {
    const title = label('adv-cardtitle l', L.x, L.ty); title.textContent = t(L.title); wrap.appendChild(title);
    const sl = document.createElement('div'); sl.className = `pp-slider h stage-${L.c}`;
    sl.style.cssText = `left:${L.x}px;top:${L.sy}px;width:${L.w}px;height:118px`;
    const thumb = document.createElement('div'); thumb.className = 'pp-thumb'; sl.appendChild(thumb); wrap.appendChild(sl);
    // blue value BELOW the slider, tappable for the full-screen numpad
    const val = label('adv-value l', L.x, L.vy);
    if (L.grey) val.style.color = GREY;
    val.style.cssText += ';text-align:left;pointer-events:auto;cursor:pointer';
    val.addEventListener('click', () => openLimNumpad(L));
    wrap.appendChild(val);
    attachLimDrag(sl, L);
    return { L, thumb, val };
  });
  return wrap;
}
// tap a blue value -> full-screen data entry, exactly like the Tcl dui_number_editor
function openLimNumpad(L) {
  const v = limVal(L.key);
  openNumpad({
    title: t(L.title.replace(/:\s*$/, '')),
    value: L.dec ? n1(v) : String(r0(v)),
    min: L.min, max: L.max, step: L.step, bigStep: L.bigStep || 1, decimals: L.dec, unit: L.unit,
    onOk: (nv) => { limSet(L.key, nv); refreshLimits(); onChange(); },
  });
}
function attachLimDrag(sl, L) {
  const set = (ev) => {
    const rect = sl.getBoundingClientRect();
    let frac = clamp((ev.clientX - rect.left) / rect.width, 0, 1);
    let v = clamp(Math.round((L.min + frac * (L.max - L.min)) / L.step) * L.step, L.min, L.max);
    limSet(L.key, v); refreshLimits(); onChange();
  };
  let drag = false;
  sl.addEventListener('pointerdown', (ev) => { drag = true; sl.setPointerCapture?.(ev.pointerId); set(ev); ev.preventDefault(); });
  sl.addEventListener('pointermove', (ev) => { if (drag) set(ev); });
  const up = (ev) => { drag = false; try { sl.releasePointerCapture?.(ev.pointerId); } catch (e) { /* */ } };
  sl.addEventListener('pointerup', up); sl.addEventListener('pointercancel', up);
}
function refreshLimits() {
  if (!limitEls) return;
  for (const { L, thumb, val } of limitEls) {
    const v = limVal(L.key);
    let frac = clamp((v - L.min) / (L.max - L.min || 1), 0, 1);
    thumb.style.left = `calc(${frac} * (100% - var(--pp-thumb)))`;
    if (L.special === 'countStart') { const idx = clamp(r0(v), 0, (live._advProfile.steps || []).length); const st = (live._advProfile.steps || [])[idx - 1]; val.textContent = idx <= 0 ? t('Immediately') : `${t('Step')} ${idx} - ${st ? t(st.name || st.pump) : ''}`; }
    else val.textContent = L.fmt(v);
  }
}

// ---- public API ----
export function renderAdvancedEditor(h, l, onCh) {
  host = h; live = l; onChange = onCh;
  if (!Array.isArray(live._advProfile?.steps)) live._advProfile = { steps: [], ...(live._advProfile || {}) };
  if (typeof live._advSel !== 'number' || live._advSel >= live._advProfile.steps.length) live._advSel = 0;

  let box = host.page.querySelector('.adv-editor');
  if (!box) {
    box = document.createElement('div'); box.className = 'adv-editor';
    box.appendChild(buildSteps(box));
    box.appendChild(buildLimits(box));
    host.page.appendChild(box);
  }
  box.style.display = 'block';
  const onLimits = live.advPage === 'settings_2c2';
  els.wrap.style.display = onLimits ? 'none' : 'block';
  limitEls[0].thumb.closest('.adv-limits').style.display = onLimits ? 'block' : 'none';
  if (onLimits) refreshLimits(); else refresh();
  setTimeout(() => { try { window.Plotly.Plots.resize(els.chart); } catch (e) { /* */ } }, 60);
}
export function hideAdvancedEditor(h) { const b = h && h.page.querySelector('.adv-editor'); if (b) b.style.display = 'none'; }
export function removeAdvancedEditor(h) { const b = h && h.page.querySelector('.adv-editor'); if (b) b.remove(); els = null; limitEls = null; }
