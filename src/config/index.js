// Merge all page families into one PageHost config (shared chrome + espresso +
// steam + water + flush), and expose the family/state mapping the app uses to
// route machine state and nav taps to pages.
import { sharedElements } from './shared.js';
import { espressoConfig } from './espresso.js';
import { steamConfig } from './steam.js';
import { waterConfig } from './water.js';
import { flushConfig } from './flush.js';

const IMG = 'assets/insight/';
const IMG_DARK = 'assets/insight-dark/';
// Background filenames (no extension) that exist in the Insight Dark image set;
// the dark theme swaps these and leaves everything else (settings, saver) light.
const DARK_IMAGES = new Set([
  'espresso_2', 'espresso_3', 'espresso_2_zoomed', 'espresso_3_zoomed',
  'steam_1', 'steam_2', 'steam_3', 'water_1', 'water_2', 'water_3',
  'preheat_1', 'preheat_2', 'preheat_3', 'preheat_4',
]);

export const config = {
  imgBase: IMG,
  darkBase: IMG_DARK,
  darkImages: DARK_IMAGES,
  pages: { ...espressoConfig.pages, ...steamConfig.pages, ...waterConfig.pages, ...flushConfig.pages },
  elements: [...sharedElements, ...espressoConfig.elements, ...steamConfig.elements, ...waterConfig.elements, ...flushConfig.elements],
};

// family -> { base config page, running page, done page, machine state that runs it }
export const families = {
  espresso: { base: 'off', run: 'espresso', done: 'espresso_3', state: 'espresso' },
  steam:    { base: 'steam_1', run: 'steam', done: 'steam_3', state: 'steam' },
  water:    { base: 'water_1', run: 'water', done: 'water_3', state: 'hotWater' },
  flush:    { base: 'preheat_1', run: 'preheat_2', done: 'preheat_3', state: 'flush' },
};
export const stateToFamily = Object.fromEntries(Object.entries(families).map(([k, v]) => [v.state, k]));
