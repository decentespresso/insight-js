// Water page (faithful to Tcl Insight water_1). Left card: glass = volume clicker,
// thermometer = temperature clicker, with big blue values + captions. Middle card:
// WAIT/START ring + mode label + "Flow rate max" row. All text is an overlay — the
// background image carries only the glass/thermometer/ring/beaker graphics.
const n0 = (v) => (typeof v === 'number' ? Math.round(v) : 0);
const n1 = (v) => (typeof v === 'number' ? v.toFixed(1) : '0.0');
const C = { title: '#42465c', val: '#4979e9', wait: '#2d3046', mode: '#969eb1', slabel: '#7e8496', sval: '#9aa0b0' };
const F = { title: 36, val: 52, cap: 30, wait: 66, mode: 40, set: 40 };  // title 30% smaller (was 52)
const row = (pages, x, y, anchor, fill, bind, o = {}) => ({ kind: 'var', pages, x, y, anchor,
  size: o.size || F.set, weight: o.weight || 'normal', fill, bind, spacing: o.spacing });

export const waterConfig = {
  pages: { water_1: 'water_1.png', water: 'water_2.png', water_3: 'water_3.png' },
  elements: [
    // ---- card titles ----
    row(['water_1'], 70, 250, 'nw', C.title, () => '1) Choose quantity and temperature', { size: F.title, weight: 'bold' }),
    row(['water_1'], 1056, 250, 'nw', C.title, () => '2) Hot water will pour', { size: F.title, weight: 'bold' }),

    // ---- volume clicker (glass): + top / - bottom ----
    { kind: 'button', pages: ['water_1'], rect: [0, 560, 520, 865], action: 'adjust',
      adj: { key: 'waterVolume', delta: +10, min: 10, max: 250, set: (v) => ({ hotWaterData: { volume: v } }) } },
    { kind: 'button', pages: ['water_1'], rect: [0, 865, 520, 1170], action: 'adjust',
      adj: { key: 'waterVolume', delta: -10, min: 10, max: 250, set: (v) => ({ hotWaterData: { volume: v } }) } },
    row(['water_1'], 300, 1238, 'center', C.val, (l) => `${n0(l.waterVolume)} mL`, { size: F.val, weight: 'bold' }),
    row(['water_1'], 300, 1292, 'center', C.val, () => 'VOLUME', { size: F.cap, spacing: 2 }),
    { kind: 'button', pages: ['water_1'], rect: [30, 1198, 520, 1320], action: 'numpad',
      np: { title: 'VOLUME', key: 'waterVolume', min: 10, max: 250, step: 10, bigStep: 50, set: (v) => ({ hotWaterData: { volume: v } }) } },

    // ---- temperature clicker (thermometer): + top / - bottom ----
    { kind: 'button', pages: ['water_1'], rect: [551, 450, 1000, 815], action: 'adjust',
      adj: { key: 'waterTemp', delta: +1, min: 20, max: 110, set: (v) => ({ hotWaterData: { targetTemperature: v } }) } },
    { kind: 'button', pages: ['water_1'], rect: [551, 815, 1000, 1180], action: 'adjust',
      adj: { key: 'waterTemp', delta: -1, min: 20, max: 110, set: (v) => ({ hotWaterData: { targetTemperature: v } }) } },
    row(['water_1'], 760, 1238, 'center', C.val, (l) => `${n1(l.waterTemp)}°C`, { size: F.val, weight: 'bold' }),
    row(['water_1'], 760, 1292, 'center', C.val, () => 'TEMP', { size: F.cap, spacing: 2 }),
    { kind: 'button', pages: ['water_1'], rect: [551, 1198, 1000, 1320], action: 'numpad',
      np: { title: 'TEMP', key: 'waterTemp', min: 20, max: 110, step: 1, bigStep: 10, set: (v) => ({ hotWaterData: { targetTemperature: v } }) } },

    // ---- start / stop / restart ring + mode label ----
    { kind: 'button', pages: ['water_1', 'water_3'], rect: [1030, 240, 1760, 1400], action: 'startWater' },
    { kind: 'button', pages: ['water'], rect: [1030, 240, 1760, 1400], action: 'stopWater' },
    row(['water_1'], 1394, 768, 'center', C.wait, () => 'START', { size: F.wait, weight: 'bold' }),
    row(['water'], 1394, 768, 'center', C.wait, () => 'STOP', { size: F.wait, weight: 'bold' }),
    row(['water_3'], 1394, 768, 'center', C.wait, () => 'RESTART', { size: F.wait, weight: 'bold' }),
    row(['water_1', 'water', 'water_3'], 1394, 856, 'center', C.mode, () => 'WATER', { size: F.mode }),

    // ---- flow-rate row + live running weight ----
    row(['water_1'], 1096, 1318, 'nw', C.slabel, () => 'Flow rate max', { size: F.set }),
    row(['water_1'], 1690, 1318, 'ne', C.sval, (l) => `${n1(l.waterFlowMax)} mL/s`, { size: F.set }),
    // full-width flow-rate slider at the bottom (left of the power button)
    { kind: 'slider', pages: ['water_1'], rect: [10, 1436, 2000, 1586], handleW: 500, trough: '#d5d9e8', fill: '#f7f5ff',
      adj: { key: 'waterFlowMax', min: 1, max: 10, step: 1, set: (v) => ({ hotWaterData: { flow: v } }) },
      valueBind: (l) => l.waterFlowMax, action: 'slideFlow' },
    row(['water'], 1394, 1010, 'center', C.title, (l) => `${n0(l.weight)} g`, { size: 44 }),
  ],
};
