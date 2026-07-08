// Water pages (faithful). water_1 config: volume clicker (left) + temperature
// clicker (mid), big values, green START ring; water running/done reuse ring.
const n0 = (v) => (typeof v === 'number' ? Math.round(v) : '');
const BTN = '#2d3046';
export const waterConfig = {
  pages: { water_1: 'water_1.png', water: 'water_2.png', water_3: 'water_3.png' },
  elements: [
    // volume clicker
    { kind: 'button', pages: ['water_1'], rect: [0, 560, 520, 865], action: 'adjust',
      adj: { key: 'waterVolume', delta: +10, min: 10, max: 250, set: (v) => ({ hotWaterData: { volume: v } }) } },
    { kind: 'button', pages: ['water_1'], rect: [0, 865, 520, 1170], action: 'adjust',
      adj: { key: 'waterVolume', delta: -10, min: 10, max: 250, set: (v) => ({ hotWaterData: { volume: v } }) } },
    { kind: 'var', pages: ['water_1'], x: 300, y: 1250, anchor: 'center', size: 84, weight: 'bold', fill: BTN, bind: (l) => `${n0(l.waterVolume)}` },
    // temperature clicker
    { kind: 'button', pages: ['water_1'], rect: [551, 450, 1000, 815], action: 'adjust',
      adj: { key: 'waterTemp', delta: +1, min: 20, max: 110, set: (v) => ({ hotWaterData: { targetTemperature: v } }) } },
    { kind: 'button', pages: ['water_1'], rect: [551, 815, 1000, 1180], action: 'adjust',
      adj: { key: 'waterTemp', delta: -1, min: 20, max: 110, set: (v) => ({ hotWaterData: { targetTemperature: v } }) } },
    { kind: 'var', pages: ['water_1'], x: 755, y: 1250, anchor: 'center', size: 84, weight: 'bold', fill: BTN, bind: (l) => `${n0(l.waterTemp)}°` },
    // start / stop / restart ring
    { kind: 'button', pages: ['water_1', 'water_3'], rect: [1030, 240, 2560, 1400], action: 'startWater' },
    { kind: 'button', pages: ['water'], rect: [0, 240, 2560, 1400], action: 'stopWater' },
    { kind: 'var', pages: ['water_1'], x: 1400, y: 800, anchor: 'center', size: 66, weight: 'bold', fill: BTN, bind: () => 'START' },
    { kind: 'var', pages: ['water'], x: 1400, y: 800, anchor: 'center', size: 66, weight: 'bold', fill: BTN, bind: () => 'STOP' },
    { kind: 'var', pages: ['water_3'], x: 1400, y: 800, anchor: 'center', size: 66, weight: 'bold', fill: BTN, bind: () => 'RESTART' },
    { kind: 'var', pages: ['water'], x: 1400, y: 1000, anchor: 'center', size: 44, fill: '#42465c', bind: (l) => `${n0(l.weight)} g` },
  ],
};
