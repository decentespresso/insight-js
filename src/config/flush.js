// Flush (preheat) pages (faithful). preheat_1 config: +/- clicker for auto-off
// seconds, big value, green START ring; preheat_2 running, preheat_3/4 done.
const n0 = (v) => (typeof v === 'number' ? Math.round(v) : '');
const BTN = '#2d3046';
export const flushConfig = {
  pages: { preheat_1: 'preheat_1.png', preheat_2: 'preheat_2.png', preheat_3: 'preheat_3.png', preheat_4: 'preheat_4.png' },
  elements: [
    { kind: 'button', pages: ['preheat_1'], rect: [290, 570, 750, 865], action: 'adjust',
      adj: { key: 'flushSeconds', delta: +1, min: 3, max: 120, set: (v) => ({ rinseData: { duration: v } }) } },
    { kind: 'button', pages: ['preheat_1'], rect: [290, 865, 750, 1160], action: 'adjust',
      adj: { key: 'flushSeconds', delta: -1, min: 3, max: 120, set: (v) => ({ rinseData: { duration: v } }) } },
    { kind: 'var', pages: ['preheat_1'], x: 520, y: 1250, anchor: 'center', size: 90, weight: 'bold', fill: BTN, bind: (l) => `${n0(l.flushSeconds)}s` },
    { kind: 'button', pages: ['preheat_1', 'preheat_3', 'preheat_4'], rect: [1100, 240, 2560, 1400], action: 'startFlush' },
    { kind: 'button', pages: ['preheat_2'], rect: [0, 240, 2560, 1600], action: 'stopFlush' },
    { kind: 'var', pages: ['preheat_1'], x: 1400, y: 800, anchor: 'center', size: 66, weight: 'bold', fill: BTN, bind: () => 'START' },
    { kind: 'var', pages: ['preheat_2'], x: 1400, y: 800, anchor: 'center', size: 66, weight: 'bold', fill: BTN, bind: () => 'STOP' },
    { kind: 'var', pages: ['preheat_3', 'preheat_4'], x: 1400, y: 800, anchor: 'center', size: 66, weight: 'bold', fill: BTN, bind: () => 'RESTART' },
  ],
};
