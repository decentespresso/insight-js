// Steam page (faithful to Tcl Insight steam_1). Left card: milk jug with a dial =
// auto-off-time clicker (+ top / - bottom), big blue value + caption below. Middle
// card: WAIT/START ring + mode label + a 4-row settings block (Enabled toggle,
// Preheat, Temperature, Flow rate max). Text/toggle are overlays on the image.
// steam = running (Information card + live chart); steam_3 = done (finished chart +
// Steaming/Done timers + RESTART), which keeps the diagnostic chart visible.
import { t, fmtTemp } from '../modules/i18n.js';
const n0 = (v) => (typeof v === 'number' ? Math.round(v) : 0);
const n1 = (v) => (typeof v === 'number' ? v.toFixed(1) : '0.0');
const C = { title: '#5e5d6f', val: '#4979e9', wait: '#2d3046', mode: '#969eb1', slabel: '#7e8496', sval: '#9aa0b0' };
const F = { title: 36, val: 52, cap: 30, wait: 66, mode: 40, set: 40 };  // title 30% smaller (was 52)
const row = (pages, x, y, anchor, fill, bind, o = {}) => ({ kind: 'var', pages, x, y, anchor,
  size: o.size || F.set, weight: o.weight || 'normal', fill, bind, spacing: o.spacing });

export const steamConfig = {
  pages: { steam_1: 'steam_1.png', steam: 'steam_2.png', steam_3: 'steam_3.png' },
  elements: [
    // ---- card titles ----
    row(['steam_1'], 70, 250, 'nw', C.title, () => `1) ${t('Choose auto-off time')}`, { size: F.title, weight: 'bold' }),
    row(['steam_1'], 1056, 250, 'nw', C.title, () => `2) ${t('Steam your milk')}`, { size: F.title, weight: 'bold' }),

    // ---- auto-off clicker (jug dial): + top / - bottom ----
    { kind: 'button', pages: ['steam_1'], rect: [200, 560, 900, 855], action: 'adjust',
      adj: { key: 'steamDuration', delta: +1, min: 1, max: 255, set: (v) => ({ steamSettings: { duration: v } }) } },
    { kind: 'button', pages: ['steam_1'], rect: [200, 855, 900, 1150], action: 'adjust',
      adj: { key: 'steamDuration', delta: -1, min: 1, max: 255, set: (v) => ({ steamSettings: { duration: v } }) } },
    row(['steam_1'], 536, 1238, 'center', C.val, (l) => `${n0(l.steamDuration)} ${t('seconds')}`, { size: F.val, weight: 'bold' }),
    row(['steam_1'], 536, 1292, 'center', C.val, () => t('AUTO-OFF'), { size: F.cap, spacing: 2 }),
    // tap the value -> full-screen numeric entry
    { kind: 'button', pages: ['steam_1'], rect: [200, 1198, 900, 1320], action: 'numpad',
      np: { title: 'AUTO-OFF', key: 'steamDuration', min: 1, max: 255, step: 1, bigStep: 10, set: (v) => ({ steamSettings: { duration: v } }) } },

    // ---- start / stop / restart ring + mode label ----
    { kind: 'button', pages: ['steam_1', 'steam_3'], rect: [1030, 240, 1760, 1400], action: 'startSteam' },
    { kind: 'button', pages: ['steam'], rect: [1030, 240, 1760, 1400], action: 'stopSteam' },
    row(['steam_1'], 1394, 768, 'center', C.wait, () => t('START'), { size: F.wait, weight: 'bold' }),
    row(['steam'], 1394, 768, 'center', C.wait, () => t('STOP'), { size: F.wait, weight: 'bold' }),
    row(['steam_3'], 1394, 768, 'center', C.wait, () => t('RESTART'), { size: F.wait, weight: 'bold' }),
    row(['steam_1', 'steam', 'steam_3'], 1394, 856, 'center', C.mode, () => t('Steam').toUpperCase(), { size: F.mode }),

    // ---- settings block: Enabled (functional toggle) / Preheat / Temperature / Flow rate ----
    row(['steam_1'], 1096, 1166, 'nw', C.slabel, () => t('Enabled'), { size: F.set }),
    { kind: 'box', pages: ['steam_1'], rect: [1600, 1150, 1706, 1196], bg: '#5b9bd8', radius: 23,
      bind: (l) => ({ bg: l.steamEnabled === false ? '#c3c7d4' : '#5b9bd8' }) },
    { kind: 'box', pages: ['steam_1'], rect: [1662, 1152, 1704, 1194], bg: '#ffffff', radius: 21,
      bind: (l) => ({ left: l.steamEnabled === false ? 1602 : 1662 }) },
    { kind: 'button', pages: ['steam_1'], rect: [1560, 1142, 1720, 1204], action: 'toggleSteam' },
    // Preheat target = the steam heater setpoint (reaprime targetTemperature); "off"
    // when disabled (the toggle sends target-temp 0, so the heater isn't kept hot).
    row(['steam_1'], 1096, 1218, 'nw', C.slabel, () => t('Preheat to'), { size: F.set }),
    row(['steam_1'], 1690, 1218, 'ne', C.sval, (l) => (l.steamEnabled === false ? t('off') : `${fmtTemp(l.steamTarget, 0)}`), { size: F.set }),
    row(['steam_1'], 1096, 1270, 'nw', C.slabel, () => t('Temperature'), { size: F.set }),
    row(['steam_1'], 1690, 1270, 'ne', C.sval, (l) => `${fmtTemp(l.steamTemp > 0 ? l.steamTemp : l.steamTarget)}`, { size: F.set }),
    row(['steam_1'], 1096, 1318, 'nw', C.slabel, () => t('Flow rate max'), { size: F.set }),
    row(['steam_1'], 1690, 1318, 'ne', C.sval, (l) => `${n1(l.steamFlowMax)} mL/s`, { size: F.set }),

    // ---- live steam temp under the STOP / STEAM ring ----
    row(['steam'], 1394, 946, 'center', C.title, (l) => `${fmtTemp(l.steamTemp, 0)}`, { size: 46 }),

    // ---- Information card (right column, RUNNING page only) — faithful to Tcl Insight
    // steam Information: Steaming / Auto-off / Temperature / Pressure / Flow rate max / now ----
    row(['steam'], 1840, 250, 'nw', C.title, () => t('Information'), { size: F.title, weight: 'bold' }),
    row(['steam'], 1840, 360, 'nw', C.slabel, () => t('Steaming'), { size: F.set }),
    row(['steam'], 2500, 360, 'ne', C.sval, (l) => `${n0(l.runElapsed)} ${t('seconds')}`, { size: F.set }),
    row(['steam'], 1840, 430, 'nw', C.slabel, () => t('Auto-Off'), { size: F.set }),
    row(['steam'], 2500, 430, 'ne', C.sval, (l) => `${n0(l.steamDuration)} ${t('seconds')}`, { size: F.set }),
    row(['steam'], 1840, 500, 'nw', C.slabel, () => t('Temperature'), { size: F.set }),
    row(['steam'], 2500, 500, 'ne', C.sval, (l) => `${fmtTemp(l.steamTemp, 0)}`, { size: F.set }),
    row(['steam'], 1840, 570, 'nw', C.slabel, () => t('Pressure (bar)'), { size: F.set }),
    row(['steam'], 2500, 570, 'ne', C.sval, (l) => `${n1(l.pressure)}`, { size: F.set }),
    row(['steam'], 1840, 640, 'nw', C.slabel, () => t('Flow rate max'), { size: F.set }),
    row(['steam'], 2500, 640, 'ne', C.sval, (l) => `${n1(l.steamFlowMax)} mL/s`, { size: F.set }),
    row(['steam'], 1840, 710, 'nw', C.slabel, () => t('Flow rate now'), { size: F.set }),
    row(['steam'], 2500, 710, 'ne', C.sval, (l) => `${n1(l.flow)} mL/s`, { size: F.set }),

    // ---- DONE page (steam_3): "Information" header + the two timers, per Tcl
    // "Steaming: Xs" / "Done: Xs" ----
    row(['steam_3'], 1840, 250, 'nw', C.title, () => t('Information'), { size: F.title, weight: 'bold' }),
    row(['steam_3'], 1840, 360, 'nw', C.slabel, (l) => `${t('Steaming')}: ${n0(l.runElapsed)}s`, { size: F.set }),
    row(['steam_3'], 1840, 430, 'nw', C.slabel, (l) => `${t('Done')}: ${n0(l.doneElapsed)}s`, { size: F.set }),

    // ---- live pressure / flow / temperature mini graph — small, bottom-aligned to
    // the lower-right card (Tcl: 700x300 at 1810,1090; card bottom ~1391). Tap to zoom. ----
    { kind: 'graph', id: 'steam_mini', pages: ['steam', 'steam_3'], rect: [1810, 1090, 2510, 1390] },
    { kind: 'button', pages: ['steam', 'steam_3'], rect: [1810, 1090, 2510, 1390], action: 'zoomSteam' },

    // full-width flow-rate slider at the bottom (left of the power button). Shown on
    // the running page too so steam flow can be adjusted live while steaming.
    { kind: 'slider', pages: ['steam_1', 'steam'], rect: [10, 1436, 2000, 1586], handleW: 500, trough: '#d5d9e8', fill: '#f7f5ff',
      adj: { key: 'steamFlowMax', min: 0.4, max: 2.5, step: 0.1, set: (v) => ({ steamSettings: { flow: v } }) },
      valueBind: (l) => l.steamFlowMax, action: 'slideFlow' },
  ],
};
