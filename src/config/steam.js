// Steam page (faithful to Tcl Insight steam_1). Left card: milk jug with a dial =
// auto-off-time clicker (+ top / - bottom), big blue value + caption below. Middle
// card: WAIT/START ring + mode label + a 4-row settings block (Enabled toggle,
// Preheat, Temperature, Flow rate max). Text/toggle are overlays on the image.
const n0 = (v) => (typeof v === 'number' ? Math.round(v) : 0);
const n1 = (v) => (typeof v === 'number' ? v.toFixed(1) : '0.0');
const C = { title: '#42465c', val: '#4979e9', wait: '#2d3046', mode: '#969eb1', slabel: '#7e8496', sval: '#9aa0b0' };
const F = { title: 52, val: 52, cap: 30, wait: 66, mode: 40, set: 40 };
const row = (pages, x, y, anchor, fill, bind, o = {}) => ({ kind: 'var', pages, x, y, anchor,
  size: o.size || F.set, weight: o.weight || 'normal', fill, bind, spacing: o.spacing });

export const steamConfig = {
  pages: { steam_1: 'steam_1.png', steam: 'steam_2.png', steam_3: 'steam_3.png' },
  elements: [
    // ---- card titles ----
    row(['steam_1'], 70, 250, 'nw', C.title, () => '1) Choose auto-off time', { size: F.title, weight: 'bold' }),
    row(['steam_1'], 1056, 250, 'nw', C.title, () => '2) Steam your milk', { size: F.title, weight: 'bold' }),

    // ---- auto-off clicker (jug dial): + top / - bottom ----
    { kind: 'button', pages: ['steam_1'], rect: [200, 560, 900, 855], action: 'adjust',
      adj: { key: 'steamDuration', delta: +1, min: 1, max: 255, set: (v) => ({ steamSettings: { duration: v } }) } },
    { kind: 'button', pages: ['steam_1'], rect: [200, 855, 900, 1150], action: 'adjust',
      adj: { key: 'steamDuration', delta: -1, min: 1, max: 255, set: (v) => ({ steamSettings: { duration: v } }) } },
    row(['steam_1'], 536, 1238, 'center', C.val, (l) => `${n0(l.steamDuration)} seconds`, { size: F.val, weight: 'bold' }),
    row(['steam_1'], 536, 1292, 'center', C.val, () => 'AUTO-OFF', { size: F.cap, spacing: 2 }),
    // tap the value -> full-screen numeric entry
    { kind: 'button', pages: ['steam_1'], rect: [200, 1198, 900, 1320], action: 'numpad',
      np: { title: 'AUTO-OFF', key: 'steamDuration', min: 1, max: 255, step: 1, bigStep: 10, set: (v) => ({ steamSettings: { duration: v } }) } },

    // ---- start / stop / restart ring + mode label ----
    { kind: 'button', pages: ['steam_1', 'steam_3'], rect: [1030, 240, 1760, 1400], action: 'startSteam' },
    { kind: 'button', pages: ['steam'], rect: [1030, 240, 1760, 1400], action: 'stopSteam' },
    row(['steam_1'], 1394, 768, 'center', C.wait, () => 'START', { size: F.wait, weight: 'bold' }),
    row(['steam'], 1394, 768, 'center', C.wait, () => 'STOP', { size: F.wait, weight: 'bold' }),
    row(['steam_3'], 1394, 768, 'center', C.wait, () => 'RESTART', { size: F.wait, weight: 'bold' }),
    row(['steam_1', 'steam', 'steam_3'], 1394, 856, 'center', C.mode, () => 'STEAM', { size: F.mode }),

    // ---- settings block: Enabled (functional toggle) / Preheat / Temperature / Flow rate ----
    row(['steam_1'], 1096, 1166, 'nw', C.slabel, () => 'Enabled', { size: F.set }),
    { kind: 'box', pages: ['steam_1'], rect: [1600, 1150, 1706, 1196], bg: '#5b9bd8', radius: 23,
      bind: (l) => ({ bg: l.steamEnabled === false ? '#c3c7d4' : '#5b9bd8' }) },
    { kind: 'box', pages: ['steam_1'], rect: [1662, 1152, 1704, 1194], bg: '#ffffff', radius: 21,
      bind: (l) => ({ left: l.steamEnabled === false ? 1602 : 1662 }) },
    { kind: 'button', pages: ['steam_1'], rect: [1560, 1142, 1720, 1204], action: 'toggleSteam' },
    // Preheat target = the steam heater setpoint (reaprime targetTemperature); "off"
    // when disabled (the toggle sends target-temp 0, so the heater isn't kept hot).
    row(['steam_1'], 1096, 1218, 'nw', C.slabel, () => 'Preheat to', { size: F.set }),
    row(['steam_1'], 1690, 1218, 'ne', C.sval, (l) => (l.steamEnabled === false ? 'off' : `${n0(l.steamTarget)}°C`), { size: F.set }),
    row(['steam_1'], 1096, 1270, 'nw', C.slabel, () => 'Temperature', { size: F.set }),
    row(['steam_1'], 1690, 1270, 'ne', C.sval, (l) => `${n1(l.steamTemp > 0 ? l.steamTemp : l.steamTarget)}°C`, { size: F.set }),
    row(['steam_1'], 1096, 1318, 'nw', C.slabel, () => 'Flow rate max', { size: F.set }),
    row(['steam_1'], 1690, 1318, 'ne', C.sval, (l) => `${n1(l.steamFlowMax)} mL/s`, { size: F.set }),

    // ---- live steam temp on running page (stacked under STOP / STEAM in the ring) ----
    row(['steam'], 1394, 946, 'center', C.title, (l) => `${n0(l.steamTemp)}°C`, { size: 46 }),

    // full-width flow-rate slider at the bottom (left of the power button)
    { kind: 'slider', pages: ['steam_1'], rect: [10, 1436, 2000, 1586], handleW: 500, trough: '#d5d9e8', fill: '#f7f5ff',
      adj: { key: 'steamFlowMax', min: 0.4, max: 2.5, step: 0.1, set: (v) => ({ steamSettings: { flow: v } }) },
      valueBind: (l) => l.steamFlowMax, action: 'slideFlow' },
  ],
};
