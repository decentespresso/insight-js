import { createSimpleBrew } from './simplebrew.js';
// Steam: target temperature + auto-off duration; live steam temp / pressure / flow.
export const createSteamView = createSimpleBrew({
  cls: 'steam', state: 'steam', title: 'Steam', timerLabel: 'Steaming', tare: false,
  targets: [
    { label: 'Steam temp', unit: '°C', min: 120, max: 170, step: 5,
      get: (w) => w?.steamSettings?.targetTemperature, set: (v) => ({ steamSettings: { targetTemperature: v } }) },
    { label: 'Auto-off', unit: 's', min: 0, max: 120, step: 5,
      get: (w) => w?.steamSettings?.duration, set: (v) => ({ steamSettings: { duration: v } }) },
  ],
  live: [
    { label: 'Steam temp', unit: '°C', get: (d) => d.steamTemperature, d: 0 },
    { label: 'Pressure', unit: 'bar', get: (d) => d.pressure },
    { label: 'Flow', unit: 'ml/s', get: (d) => d.flow },
  ],
});
