// Flush (preheat) page (faithful to Tcl Insight preheat_1). Left card: glass with a
// dial = auto-off-time clicker (+ top / - bottom), big blue value + caption. Middle
// card: WAIT/START ring + mode label + "Flow rate max" row. Text overlays the image.
const n0 = (v) => (typeof v === 'number' ? Math.round(v) : 0);
const n1 = (v) => (typeof v === 'number' ? v.toFixed(1) : '0.0');
const C = { title: '#42465c', val: '#4979e9', wait: '#2d3046', mode: '#969eb1', slabel: '#7e8496', sval: '#9aa0b0' };
const F = { title: 36, val: 52, cap: 30, wait: 66, mode: 40, set: 40 };  // title 30% smaller (was 52)
const row = (pages, x, y, anchor, fill, bind, o = {}) => ({ kind: 'var', pages, x, y, anchor,
  size: o.size || F.set, weight: o.weight || 'normal', fill, bind, spacing: o.spacing });

export const flushConfig = {
  pages: { preheat_1: 'preheat_1.png', preheat_2: 'preheat_2.png', preheat_3: 'preheat_3.png', preheat_4: 'preheat_4.png' },
  elements: [
    // ---- card titles ----
    row(['preheat_1'], 70, 250, 'nw', C.title, () => '1) Choose auto-off time', { size: F.title, weight: 'bold' }),
    row(['preheat_1'], 1056, 250, 'nw', C.title, () => '2) Hot water will pour', { size: F.title, weight: 'bold' }),
    // warning shown when a long, fast flush could cool the group head; left-
    // aligned under the "1)" title (x=70), matching Tcl (centered in a wide box
    // whose left edge sits under the "1").
    row(['preheat_1'], 70, 370, 'nw', '#5a5d75', (l) => (l.flushSeconds > 10 && l.flushFlowMax > 4.0 ? 'Warning: long flush times can cool the group head' : ''), { size: 32 }),

    // ---- auto-off clicker (glass dial): + top / - bottom ----
    { kind: 'button', pages: ['preheat_1'], rect: [290, 570, 750, 865], action: 'adjust',
      adj: { key: 'flushSeconds', delta: +1, min: 3, max: 120, set: (v) => ({ rinseData: { duration: v } }) } },
    { kind: 'button', pages: ['preheat_1'], rect: [290, 865, 750, 1160], action: 'adjust',
      adj: { key: 'flushSeconds', delta: -1, min: 3, max: 120, set: (v) => ({ rinseData: { duration: v } }) } },
    row(['preheat_1'], 520, 1238, 'center', C.val, (l) => `${n0(l.flushSeconds)} seconds`, { size: F.val, weight: 'bold' }),
    row(['preheat_1'], 520, 1292, 'center', C.val, () => 'AUTO-OFF', { size: F.cap, spacing: 2 }),
    // tap the value -> full-screen numeric entry
    { kind: 'button', pages: ['preheat_1'], rect: [200, 1198, 850, 1320], action: 'numpad',
      np: { title: 'AUTO-OFF', key: 'flushSeconds', min: 3, max: 120, step: 1, bigStep: 10, set: (v) => ({ rinseData: { duration: v } }) } },

    // ---- start / stop / restart ring + mode label ----
    { kind: 'button', pages: ['preheat_1', 'preheat_3', 'preheat_4'], rect: [1030, 240, 1760, 1400], action: 'startFlush' },
    { kind: 'button', pages: ['preheat_2'], rect: [1030, 240, 1760, 1400], action: 'stopFlush' },
    row(['preheat_1'], 1394, 768, 'center', C.wait, () => 'START', { size: F.wait, weight: 'bold' }),
    row(['preheat_2'], 1394, 768, 'center', C.wait, () => 'STOP', { size: F.wait, weight: 'bold' }),
    row(['preheat_3', 'preheat_4'], 1394, 768, 'center', C.wait, () => 'RESTART', { size: F.wait, weight: 'bold' }),
    row(['preheat_1', 'preheat_2', 'preheat_3', 'preheat_4'], 1394, 856, 'center', C.mode, () => 'FLUSH', { size: F.mode }),

    // ---- flow-rate row ----
    row(['preheat_1'], 1096, 1318, 'nw', C.slabel, () => 'Flow rate max', { size: F.set }),
    row(['preheat_1'], 1690, 1318, 'ne', C.sval, (l) => `${n1(l.flushFlowMax)} mL/s`, { size: F.set }),
    // full-width flow-rate slider at the bottom (left of the power button)
    { kind: 'slider', pages: ['preheat_1'], rect: [10, 1436, 2000, 1586], handleW: 500, trough: '#d5d9e8', fill: '#f7f5ff',
      adj: { key: 'flushFlowMax', min: 1, max: 10, step: 1, set: (v) => ({ rinseData: { flow: v } }) },
      valueBind: (l) => l.flushFlowMax, action: 'slideFlow' },
  ],
};
