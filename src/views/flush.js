import { createSimpleBrew } from './simplebrew.js';
// Flush (group rinse): auto-off duration + flow; live flow / weight.
export const createFlushView = createSimpleBrew({
  cls: 'flush', state: 'flush', title: 'Flush', timerLabel: 'Flushing', tare: true,
  targets: [
    { label: 'Auto-off', unit: 's', min: 1, max: 30, step: 1,
      get: (w) => w?.rinseData?.duration, set: (v) => ({ rinseData: { duration: v } }) },
    { label: 'Flow', unit: 'ml/s', min: 1, max: 10, step: 0.5, fmt: (v) => v.toFixed(1),
      get: (w) => w?.rinseData?.flow, set: (v) => ({ rinseData: { flow: v } }) },
  ],
  live: [
    { label: 'Flow', unit: 'ml/s', get: (d) => d.flow },
    { label: 'Weight', unit: 'g', get: (d, w) => w },
  ],
});
