import { createSimpleBrew } from './simplebrew.js';
// Hot water: target temperature + volume; live weight / flow.
export const createWaterView = createSimpleBrew({
  cls: 'water', state: 'hotWater', title: 'Water', timerLabel: 'Pouring', tare: true,
  targets: [
    { label: 'Water temp', unit: '°C', min: 20, max: 100, step: 5,
      get: (w) => w?.hotWaterData?.targetTemperature, set: (v) => ({ hotWaterData: { targetTemperature: v } }) },
    { label: 'Volume', unit: 'ml', min: 10, max: 300, step: 10,
      get: (w) => w?.hotWaterData?.volume, set: (v) => ({ hotWaterData: { volume: v } }) },
  ],
  live: [
    { label: 'Weight', unit: 'g', get: (d, w) => w },
    { label: 'Flow', unit: 'ml/s', get: (d) => d.flow },
  ],
});
