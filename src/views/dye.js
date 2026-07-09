// DYE — "Describe Your Espresso" — image-backed, faithful to the Tcl Insight
// describe_espresso pages, plus the Scent One aroma wheel. Same engine as the
// brew/settings pages: a PageHost over the describe_espresso*/scentone_* image
// set, with text labels + a slider + tap zones as overlays, and HTML text inputs
// injected in native 2560x1600 space for the free-text fields.
//
// Data model (reaprime): shot notes + rating + flavour list live on the shot
// record; coffee/grinder/dose/yield live on the workflow context so the next shot
// remembers them.
import * as api from '../modules/api.js';
import { PageHost } from '../modules/page.js';
import { openOverlay, closeOverlay } from '../modules/overlay.js';
import { t } from '../modules/i18n.js';
import { logger } from '../modules/logger.js';

const IMG = 'assets/insight/';
const FONT = "'InsightUI', Helvetica, Arial, sans-serif";
const C = { head: '#7f879a', headOff: '#bbbbbb', val: '#4e85f4', pick: '#4e85f4' };

// Scent One categories -> flavours (from skins/Insight/scentone.tcl). The category
// backgrounds are photographic; the flavour labels + tap zones are overlays laid
// out in the same two-row grid the Tcl skin uses.
const AROMA = {
  'Tropical fruit': ['Guava', 'Mangosteen', 'Mango', 'Banana', 'Coconut', 'Passion fruit', 'Watermelon', 'Papaya', 'Tropical fruits', 'Pineapple', 'Melon', 'Lychee'],
  'Berry': ['Strawberry', 'Blueberry', 'Raspberry', 'Cranberry', 'Blackberry', 'Acai berry', 'Black currant', 'White grape', 'Muscat grape', 'Red grape'],
  'Citrus': ['Pomegranate', 'Aloe', 'Lemon', 'Orange', 'Lime', 'Yuzu', 'Grapefruit', 'Chinese pear', 'Apple', 'Quince'],
  'Stone fruit': ['Acerola', 'Light cherry', 'Dark cherry', 'Peach', 'Plum', 'Apricot'],
  'Nut & cereal': ['Hazelnut', 'Walnut', 'Pine nut', 'Almond', 'Peanut', 'Pistachio', 'Sesame', 'Red bean', 'Malt', 'Toasted rice', 'Roasted'],
  'Chocolate & caramel': ['Caramel', 'Brown sugar', 'Honey', 'Maple syrup', 'Milk chocolate', 'Dark chocolate', 'Mocha', 'Cream', 'Butter', 'Yogurt', 'Vanilla'],
  'Flower & herb': ['Pine', 'Hawthorn', 'Earl grey', 'Rose', 'Jasmin', 'Acacia', 'Elderflower', 'Lavender', 'Bergamot', 'Chrysanthemum', 'Hibiscus', 'Eucalyptus'],
  'Spice': ['Basil', 'Thyme', 'Cinnamon', 'Nutmeg', 'Clove', 'Cardamon', 'Star anise', 'Cumin', 'Black pepper', 'Garlic', 'Ginger'],
  'Vegetable': ['Date', 'Pumpkin', 'Tomato', 'Cucumber', 'Mushroom', 'Taro', 'Arrowroot', 'Ginseng', 'Paprika'],
  'Savory': ['Cheddar', 'Soy sauce', 'Mustard', 'Mayonnaise', 'Musk', 'Amber', 'Smoke', 'Beef'],
};
const CAT_PAGE = { 'Tropical fruit': 'scentone_tropical', 'Berry': 'scentone_berry', 'Citrus': 'scentone_citrus',
  'Stone fruit': 'scentone_stone', 'Nut & cereal': 'scentone_cereal', 'Chocolate & caramel': 'scentone_chocolate',
  'Flower & herb': 'scentone_flower', 'Spice': 'scentone_spice', 'Vegetable': 'scentone_vegetable', 'Savory': 'scentone_savory' };
// scentone_1 category tap zones + label anchors (from scentone.tcl)
const CATS = [
  ['Tropical fruit', [15, 290, 520, 860], 300, 800], ['Berry', [522, 290, 1100, 860], 830, 800],
  ['Citrus', [1102, 290, 1660, 860], 1370, 800], ['Stone fruit', [1662, 290, 2050, 860], 1850, 800],
  ['Nut & cereal', [2052, 290, 2550, 860], 2280, 800], ['Chocolate & caramel', [15, 862, 560, 1400], 300, 1380],
  ['Flower & herb', [562, 862, 1070, 1400], 830, 1380], ['Spice', [1072, 862, 1690, 1400], 1370, 1380],
  ['Vegetable', [1692, 862, 2140, 1400], 1931, 1380], ['Savory', [2142, 862, 2550, 1400], 2330, 1380],
];

let host, live, ctxState, shotId = null, selected = new Set();
const V = (pages, x, y, o) => ({ kind: 'var', pages, x, y, anchor: o.anchor || 'nw', size: o.size || 34,
  weight: o.weight || 'normal', fill: o.fill || C.head, family: FONT, bind: o.bind, fillBind: o.fillBind, width: o.width, wrap: o.wrap });
const B = (pages, rect, action, extra) => ({ kind: 'button', pages, rect, action, ...extra });

// --- header tabs (This espresso / Your setup) shared across the describe pages ---
const DESC = ['describe_espresso', 'describe_espresso2'];
const headerEls = [
  V(DESC, 1330, 230, { anchor: 'center', size: 44, weight: 'bold', bind: () => t('This espresso'), fillBind: (l) => (l.page === 'describe_espresso' ? C.head : C.headOff) }),
  V(DESC, 2160, 230, { anchor: 'center', size: 44, weight: 'bold', bind: () => t('Your setup'), fillBind: (l) => (l.page === 'describe_espresso2' ? C.head : C.headOff) }),
  B(DESC, [860, 0, 1680, 300], 'tabThis'),
  B(DESC, [1710, 0, 2560, 300], 'tabSetup'),
  // baked Cancel / Ok (scentone.tcl 1505.. / 2016..)
  B(DESC, [1505, 1406, 2015, 1600], 'cancel'),
  B(DESC, [2016, 1406, 2560, 1600], 'save'),
  V(DESC, 1760, 1500, { anchor: 'center', size: 44, weight: 'bold', fill: '#ffffff', bind: () => t('Cancel') }),
  V(DESC, 2275, 1500, { anchor: 'center', size: 44, weight: 'bold', fill: '#ffffff', bind: () => t('Ok') }),
];

// --- "This espresso" page: enjoyment slider + notes + flavours + weight ---
const P_THIS = ['describe_espresso'];
const thisEls = [
  V(P_THIS, 80, 360, { size: 40, weight: 'bold', bind: () => t('Enjoyment') }),
  V(P_THIS, 1300, 600, { anchor: 'ne', size: 40, fill: C.val, bind: (l) => String(l.enjoy ?? 75) }),
  { kind: 'slider', pages: P_THIS, rect: [300, 470, 1300, 590], handleW: 130, trough: '#e2e2e2', fill: '#e4d1c1',
    adj: { key: 'enjoy', min: 0, max: 100, step: 1 }, valueBind: (l) => l.enjoy ?? 75, action: 'slideEnjoy' },
  V(P_THIS, 80, 740, { size: 40, weight: 'bold', bind: () => t('Notes') }),          // textarea injected below
  V(P_THIS, 1610, 360, { size: 40, weight: 'bold', bind: () => t('Flavors') }),
  V(P_THIS, 1610, 440, { size: 30, fill: C.head, width: 820, wrap: true, bind: (l) => l.flavours || t('(none — tap to choose)') }),
  B(P_THIS, [1600, 350, 2540, 800], 'openScent'),
  V(P_THIS, 1630, 900, { size: 40, weight: 'bold', bind: () => t('Weight') }),        // number injected below
];

// --- "Your setup" page: grinder + beans + name (all injected text fields) ---
const P_SETUP = ['describe_espresso2'];
const setupEls = [
  V(P_SETUP, 80, 360, { size: 40, weight: 'bold', bind: () => t('Grinder') }),
  V(P_SETUP, 540, 445, { anchor: 'ne', size: 34, bind: () => t('Model') }),
  V(P_SETUP, 540, 535, { anchor: 'ne', size: 34, bind: () => t('Setting') }),
  V(P_SETUP, 540, 625, { anchor: 'ne', size: 34, bind: () => t('Dose weight') }),
  V(P_SETUP, 80, 790, { size: 40, weight: 'bold', bind: () => t('Beans') }),
  V(P_SETUP, 540, 865, { anchor: 'ne', size: 34, bind: () => t('Brand') }),
  V(P_SETUP, 540, 945, { anchor: 'ne', size: 34, bind: () => t('Type') }),
  V(P_SETUP, 1340, 360, { size: 40, weight: 'bold', bind: () => t('Your name') }),
];

// --- Scent One wheel: category page + per-category choice pages ---
const scentEls = [
  V(['scentone_1'], 1280, 140, { anchor: 'center', size: 56, weight: 'bold', fill: '#595d78', bind: (l) => l.scentSel || '' }),
  ...CATS.flatMap(([cat, rect, lx, ly]) => [
    V(['scentone_1'], lx, ly, { anchor: 'center', size: 34, weight: 'bold', fill: C.headOff, bind: () => t(cat) }),
    B(['scentone_1'], rect, 'openCat', { cat }),
  ]),
  // scentone_1 footer: reset / save-back-to-describe (baked buttons)
  B(['scentone_1'], [1505, 1406, 2015, 1600], 'scentReset'),
  B(['scentone_1'], [2016, 1406, 2560, 1600], 'scentDone'),
  V(['scentone_1'], 1760, 1500, { anchor: 'center', size: 44, weight: 'bold', fill: '#ffffff', bind: () => t('Reset') }),
  V(['scentone_1'], 2275, 1500, { anchor: 'center', size: 44, weight: 'bold', fill: '#ffffff', bind: () => t('Save') }),
  // per-category choice pages (title + two-row grid of tappable flavours)
  ...Object.entries(AROMA).flatMap(([cat, list]) => choiceEls(cat, list)),
];

// Build the flavour labels + tap zones for one category page, in the Tcl two-row
// layout, spread evenly across the width (row 1 upper, row 2 lower).
function choiceEls(cat, list) {
  const page = CAT_PAGE[cat];
  const els = [V([page], 1280, 140, { anchor: 'center', size: 56, weight: 'bold', fill: '#595d78', bind: () => t(cat) }),
    B([page], [2016, 1406, 2560, 1600], 'catBack'), V([page], 2275, 1500, { anchor: 'center', size: 44, weight: 'bold', fill: '#ffffff', bind: () => t('Ok') })];
  const half = Math.ceil(list.length / 2);
  [list.slice(0, half), list.slice(half)].forEach((items, ri) => {
    const y = ri === 0 ? 800 : 1380, yTop = ri === 0 ? 290 : 862, yBot = ri === 0 ? 860 : 1400;
    const n = items.length || 1;
    items.forEach((flavor, ci) => {
      const cx = Math.round((ci + 0.5) * 2560 / n), x1 = Math.round(ci * 2560 / n), x2 = Math.round((ci + 1) * 2560 / n);
      els.push(V([page], cx, y, { anchor: 'center', size: 34, weight: 'bold', fill: C.headOff, bind: () => t(flavor), fillBind: () => (selected.has(flavor) ? C.pick : C.headOff) }));
      els.push(B([page], [x1, yTop, x2, yBot], 'toggleFlavor', { flavor }));
    });
  });
  return els;
}

const config = {
  imgBase: IMG,
  pages: {
    describe_espresso: 'describe_espresso.avif', describe_espresso2: 'describe_espresso2.avif',
    scentone_1: 'scentone_1.avif',
    ...Object.fromEntries(Object.values(CAT_PAGE).map((p) => [p, p + '.avif'])),
  },
  elements: [...headerEls, ...thisEls, ...setupEls, ...scentEls],
};

// --- injected HTML text fields (page.js has no input kind) -------------------
// Positioned in 2560-space; shown only on their page.
const FIELDS = {
  describe_espresso: [{ key: 'notes', tag: 'textarea', x: 80, y: 820, w: 1400, h: 340, ph: 'How did it taste?' },
    { key: 'weight', tag: 'input', type: 'number', x: 1630, y: 970, w: 500, h: 90, ph: 'g' }],
  describe_espresso2: [
    { key: 'grinderModel', tag: 'input', x: 560, y: 420, w: 700, h: 90 },
    { key: 'grinderSetting', tag: 'input', x: 560, y: 510, w: 700, h: 90 },
    { key: 'dose', tag: 'input', type: 'number', x: 560, y: 600, w: 700, h: 90 },
    { key: 'coffeeRoaster', tag: 'input', x: 560, y: 840, w: 700, h: 90 },
    { key: 'coffeeName', tag: 'input', x: 560, y: 930, w: 700, h: 90 },
    { key: 'myName', tag: 'input', x: 1340, y: 430, w: 900, h: 90 },
  ],
};
function renderFields(pageId) {
  let layer = host.page.querySelector('.dye-fields');
  if (!layer) { layer = document.createElement('div'); layer.className = 'dye-fields'; host.page.appendChild(layer); }
  layer.innerHTML = '';
  (FIELDS[pageId] || []).forEach((f) => {
    const n = document.createElement(f.tag);
    if (f.type) n.type = f.type;
    if (f.ph) n.placeholder = f.ph;
    n.className = 'dye-input';
    Object.assign(n.style, { position: 'absolute', left: f.x + 'px', top: f.y + 'px', width: f.w + 'px', height: f.h + 'px' });
    n.value = live[f.key] ?? '';
    n.addEventListener('input', () => { live[f.key] = n.value; });
    layer.appendChild(n);
  });
  layer.style.display = FIELDS[pageId] ? 'block' : 'none';
}

function show(pageId) {
  live.page = pageId; host.show(pageId); host.update(live);
  renderFields(pageId);
}

const flavoursText = () => [...selected].map((f) => t(f)).join(', ');

const actions = {
  tabThis: () => show('describe_espresso'), tabSetup: () => show('describe_espresso2'),
  slideEnjoy: (el, h, v) => { live.enjoy = Math.round(v); host.update(live); },
  openScent: () => { live.scentSel = flavoursText(); show('scentone_1'); },
  openCat: (el) => show(CAT_PAGE[el.cat]),
  catBack: () => { live.scentSel = flavoursText(); show('scentone_1'); },
  toggleFlavor: (el) => { if (selected.has(el.flavor)) selected.delete(el.flavor); else selected.add(el.flavor); host.update(live); },
  scentReset: () => { selected.clear(); host.update(live); },
  scentDone: () => { live.flavours = flavoursText(); show('describe_espresso'); },
  cancel: () => closeOverlay(),
  save: () => doSave(),
};

async function doSave() {
  live.flavours = flavoursText();
  const ctx = {
    coffeeRoaster: live.coffeeRoaster || '', coffeeName: live.coffeeName || '',
    grinderModel: live.grinderModel || '', grinderSetting: live.grinderSetting || '',
    targetDoseWeight: parseFloat(live.dose) || undefined,
  };
  try {
    if (shotId) await api.updateShot(shotId, { shotNotes: live.notes || '', metadata: { rating: live.enjoy ?? 75, flavours: [...selected], drinkWeight: parseFloat(live.weight) || undefined } });
    await api.updateWorkflow({ context: ctx });
    if (live.myName) localStorage.setItem('insight_my_name', live.myName);
    closeOverlay();
  } catch (e) { logger.error('dye save', e); }
}

export async function openDYE() {
  const stage = document.createElement('div');
  stage.className = 's2stage dye-stage';
  stage.innerHTML = '<div class="s2page"></div>';
  openOverlay(stage);
  live = { page: 'describe_espresso', enjoy: 75, notes: '', weight: '', flavours: '',
    grinderModel: '', grinderSetting: '', dose: '', coffeeRoaster: '', coffeeName: '',
    myName: localStorage.getItem('insight_my_name') || '', scentSel: '' };
  selected = new Set();
  host = new PageHost(stage, config, actions, stage.querySelector('.s2page'));

  // Prefill from workflow context + latest shot
  try {
    const wf = await api.getWorkflow(); ctxState = wf?.context || {};
    live.coffeeRoaster = ctxState.coffeeRoaster || ''; live.coffeeName = ctxState.coffeeName || '';
    live.grinderModel = ctxState.grinderModel || ''; live.grinderSetting = ctxState.grinderSetting || '';
    if (ctxState.targetDoseWeight) live.dose = ctxState.targetDoseWeight;
  } catch (e) { logger.warn('dye wf', e); }
  try {
    const shot = await api.getLatestShot(); shotId = shot?.id;
    if (shot?.shotNotes) live.notes = shot.shotNotes;
    if (shot?.metadata?.rating != null) live.enjoy = shot.metadata.rating;
    if (Array.isArray(shot?.metadata?.flavours)) selected = new Set(shot.metadata.flavours);
    if (shot?.metadata?.drinkWeight) live.weight = shot.metadata.drinkWeight;
  } catch (e) { logger.info('no latest shot'); }
  live.flavours = flavoursText();
  show('describe_espresso');
}
