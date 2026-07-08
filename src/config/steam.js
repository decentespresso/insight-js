// Steam pages (faithful). steam_1 config: +/- clicker for steam duration
// (top of the jug = +, bottom = -), big value in the dial, green START ring in
// the centre panel. steam running/done reuse the ring.
const n0 = (v) => (typeof v === 'number' ? Math.round(v) : '');
const BTN = '#2d3046';
export const steamConfig = {
  pages: { steam_1: 'steam_1.png', steam: 'steam_2.png', steam_3: 'steam_3.png' },
  elements: [
    // steam duration clicker (jug): + top half, - bottom half
    { kind: 'button', pages: ['steam_1'], rect: [200, 560, 900, 855], action: 'adjust',
      adj: { key: 'steamDuration', delta: +1, min: 1, max: 255, set: (v) => ({ steamSettings: { duration: v } }) } },
    { kind: 'button', pages: ['steam_1'], rect: [200, 855, 900, 1150], action: 'adjust',
      adj: { key: 'steamDuration', delta: -1, min: 1, max: 255, set: (v) => ({ steamSettings: { duration: v } }) } },
    { kind: 'var', pages: ['steam_1'], x: 537, y: 990, anchor: 'center', size: 90, weight: 'bold', fill: BTN, bind: (l) => `${n0(l.steamDuration)}s` },
    // start / stop / restart ring (centre panel)
    { kind: 'button', pages: ['steam_1', 'steam_3'], rect: [1030, 240, 2560, 1100], action: 'startSteam' },
    { kind: 'button', pages: ['steam'], rect: [0, 240, 2560, 1400], action: 'stopSteam' },
    { kind: 'var', pages: ['steam_1'], x: 1400, y: 800, anchor: 'center', size: 66, weight: 'bold', fill: BTN, bind: () => 'START' },
    { kind: 'var', pages: ['steam'], x: 1400, y: 800, anchor: 'center', size: 66, weight: 'bold', fill: BTN, bind: () => 'STOP' },
    { kind: 'var', pages: ['steam_3'], x: 1400, y: 800, anchor: 'center', size: 66, weight: 'bold', fill: BTN, bind: () => 'RESTART' },
    // live steam temp on running page
    { kind: 'var', pages: ['steam'], x: 1400, y: 1000, anchor: 'center', size: 44, fill: '#42465c', bind: (l) => `${n0(l.steamTemp)}°C` },
  ],
};
