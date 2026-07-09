// Insight settings section — IMAGE-BACKED, same engine as the brew pages.
// The default-skin settings_*.png backgrounds carry the 4-tab bar, card frames
// and icons (converted to AVIF in assets/insight/); this module overlays the
// text labels + dynamic values + tap zones in the native 2560x1600 space via a
// second PageHost instance, exactly like espresso/steam/water/flush.
//
// reaprime differs from Tcl, so fields with no gateway endpoint show a dash or a
// short note rather than being faked (see the session summary for the gap list).
import * as api from '../modules/api.js';
import { PageHost } from '../modules/page.js';
import { MiniChart } from '../modules/chart.js';
import { openOverlay, closeOverlay } from '../modules/overlay.js';
import { openGFC } from './gfc.js';
import { openProfileEditor } from './profile_editor.js';
import { openMaintenance } from './maintenance.js';
import { setLang, currentLangName, LANGUAGES, t } from '../modules/i18n.js';
import { logger } from '../modules/logger.js';

const IMG = 'assets/insight/';
// Card titles in the Tcl settings pages are a soft grey-blue (not navy); rows a
// medium grey. Colours sampled from the sstcl screenshots.
const C = { title: '#646a7c', label: '#4c4f5c', val: '#4979e9', dark: '#2d3046', tabOff: '#7e8496', muted: '#7e8496', na: '#b06a6a' };
const FONT = "'InsightUI', Helvetica, Arial, sans-serif";

// element helpers (mirror the brew configs)
const V = (pages, x, y, o) => ({ kind: 'var', pages, x, y, anchor: o.anchor || 'nw', size: o.size || 34,
  weight: o.weight || 'normal', fill: o.fill || C.dark, family: FONT, bind: o.bind, fillBind: o.fillBind,
  spacing: o.spacing, width: o.width, wrap: o.wrap, justify: o.justify, clamp: o.clamp, scroll: o.scroll, notPages: o.notPages });
const B = (pages, rect, action, notPages) => ({ kind: 'button', pages, rect, action, notPages });

// The 4 settings tabs share this top bar (icons are baked; labels overlaid).
const PAGES = { presets: 'settings_1', advanced: 'settings_2c', machine: 'settings_3', app: 'settings_4' };
// x positions from the Tcl (de1_skin_settings.tcl pos_*_label): centred between
// each tab icon and the tab's right edge. Tab 2 is a dynamic two-line label
// (profile type + name), so it is built separately below.
const TAB_LABELS = [
  ['presets', 'PRESETS', 380], ['machine', 'MACHINE', 1650], ['app', 'APP', 2270],
];
const TAB2_X = 1010;
// Full-screen sub-pages hide the tab bar + main Cancel/Ok. settings_message is
// the generic dialog frame; settings_3_choices is the New-Preset chooser.
const MODAL = ['settings_message'];
const HIDE_CHROME = ['settings_message', 'settings_3_choices'];
const tabBar = [
  B(['*'], [0, 0, 640, 190], 'navPresets', HIDE_CHROME),
  B(['*'], [640, 0, 1280, 190], 'navAdvanced', HIDE_CHROME),
  B(['*'], [1280, 0, 1920, 190], 'navMachine', HIDE_CHROME),
  B(['*'], [1920, 0, 2560, 190], 'navApp', HIDE_CHROME),
  ...TAB_LABELS.map(([tab, text, x]) => V(['*'], x, 100, { anchor: 'center', size: 50, weight: 'bold', notPages: HIDE_CHROME,
    bind: () => t(text), fillBind: (l) => (l.tab === tab ? C.dark : C.tabOff) })),
  // Tab 2 — dynamic: profile TYPE (PRESSURE/FLOW/ADVANCED) + profile name below.
  V(['*'], TAB2_X, 72, { anchor: 'center', size: 50, weight: 'bold', notPages: HIDE_CHROME,
    bind: (l) => l.tabType || t('Advanced').toUpperCase(), fillBind: (l) => (l.tab === 'advanced' ? C.dark : C.tabOff) }),
  V(['*'], TAB2_X, 128, { anchor: 'center', size: 32, notPages: HIDE_CHROME,
    bind: (l) => l.tabName || '', fillBind: (l) => (l.tab === 'advanced' ? C.dark : C.tabOff) }),
  // baked Cancel / Ok frames at the bottom (button centre ≈ 2560-y 1500)
  B(['*'], [1500, 1440, 2040, 1560], 'cancel', HIDE_CHROME),
  B(['*'], [2050, 1440, 2560, 1560], 'ok', HIDE_CHROME),
  V(['*'], 1770, 1520, { anchor: 'center', size: 48, weight: 'bold', fill: '#ffffff', notPages: HIDE_CHROME, bind: () => t('Cancel') }),
  V(['*'], 2305, 1520, { anchor: 'center', size: 48, weight: 'bold', fill: '#ffffff', notPages: HIDE_CHROME, bind: () => t('Ok') }),
  // ---- settings_message dialog chrome (title + baked Ok) ----
  // Title centered in the lavender header band (above the white content box);
  // Ok label centered on the baked button (1254–1376 in 2560-space => ~1315).
  V(MODAL, 1280, 300, { anchor: 'center', size: 72, weight: 'bold', fill: C.dark, bind: (l) => l.dialogTitle || '' }),
  B(MODAL, [1030, 1240, 1560, 1390], 'dialogOk'),
  V(MODAL, 1293, 1316, { anchor: 'center', size: 52, weight: 'bold', fill: '#fafbff', bind: () => t('Ok') }),
];

// ---- MACHINE (settings_3) -------------------------------------------------
const P3 = ['settings_3'];
const row3 = (y, label, valBind) => [
  V(P3, 60, y, { size: 40, fill: C.label, bind: () => t(label) }),
  V(P3, 1120, y, { anchor: 'ne', size: 40, fill: C.dark, bind: valBind }),
];
const machineEls = [
  // Counter card
  V(P3, 55, 245, { size: 50, weight: 'bold', fill: C.title, bind: () => t('Counter') }),
  ...row3(345, 'Espresso', (l) => String(l.cEspresso ?? '—')),
  ...row3(405, 'Steam', () => '—'),
  ...row3(465, 'Hot water', () => '—'),
  // Version card
  V(P3, 55, 560, { size: 50, weight: 'bold', fill: C.title, bind: () => t('Version') }),
  V(P3, 55, 640, { size: 36, fill: C.muted, bind: (l) => l.version || '—' }),
  // Energy saver card
  V(P3, 55, 775, { size: 50, weight: 'bold', fill: C.title, bind: () => t('Energy saver') }),
  V(P3, 60, 880, { size: 40, fill: C.label, bind: (l) => `${t('Cool down after:')} ${l.coolMin ?? 30} ${t('min')}` }),
  B(P3, [40, 850, 1140, 960], 'editCool'),
  V(P3, 60, 1040, { size: 44, fill: C.val, bind: (l) => (l.keepHot ? `● ${t('Keep hot')}: ${t('ON')}` : `○ ${t('Keep hot')}: ${t('OFF')}`) }),
  B(P3, [40, 1010, 1140, 1110], 'toggleKeepHot'),
  // Maintenance card — labels overlaid on the baked icon buttons
  V(P3, 1310, 245, { size: 50, weight: 'bold', fill: C.title, bind: () => t('Maintenance') }),
  V(P3, 2510, 250, { anchor: 'ne', size: 38, fill: C.val, bind: () => `[${t('Read Manual')}: ${t('Cleaning')}]` }),
  V(P3, 1720, 435, { anchor: 'center', size: 48, fill: C.dark, bind: () => t('Clean') }),
  V(P3, 2330, 435, { anchor: 'center', size: 48, fill: C.dark, bind: () => t('Descale') }),
  V(P3, 1720, 620, { anchor: 'center', size: 48, fill: C.dark, bind: () => t('Calibrate') }),
  V(P3, 2330, 620, { anchor: 'center', size: 48, fill: '#9aa0b0', bind: () => t('Transport') }),
  B(P3, [1325, 360, 1910, 510], 'clean'),
  B(P3, [1945, 360, 2535, 510], 'descale'),
  B(P3, [1325, 545, 1910, 695], 'calibrate'),
  // Firmware card (tap the button to open the firmware panel)
  V(P3, 1310, 770, { size: 50, weight: 'bold', fill: C.title, bind: () => t('Firmware') }),
  V(P3, 1780, 915, { anchor: 'center', size: 48, fill: C.dark, bind: (l) => `v${l.fw ?? '?'} · ${t('Update')}…` }),
  B(P3, [1325, 845, 2535, 985], 'firmware'),
  // Water level card
  V(P3, 1310, 1090, { size: 50, weight: 'bold', fill: C.title, bind: () => t('Water level') }),
  V(P3, 1310, 1180, { size: 36, fill: C.na, bind: () => 'Not reported by this gateway build' }),
];

// ---- APP (settings_4) -----------------------------------------------------
const P4 = ['settings_4'];
const appEls = [
  V(P4, 55, 245, { size: 50, weight: 'bold', fill: C.title, bind: () => t('Update app') }),
  V(P4, 55, 330, { size: 36, fill: C.muted, bind: (l) => l.appVer || 'checking…' }),
  B(P4, [40, 400, 1140, 520], 'appUpdate'),
  V(P4, 55, 560, { size: 50, weight: 'bold', fill: C.title, bind: () => t('Screen brightness') }),
  V(P4, 60, 660, { size: 40, fill: C.val, bind: (l) => `${t('App')}: ${l.brightness ?? 100}%` }),
  B(P4, [40, 630, 1140, 740], 'editBrightness'),
  V(P4, 55, 900, { size: 50, weight: 'bold', fill: C.title, bind: () => t('Connect') }),
  V(P4, 60, 1000, { size: 36, fill: C.dark, bind: (l) => l.devs || 'no devices' }),
  B(P4, [40, 960, 1140, 1120], 'searchDevices'),
  // right column buttons (Skin / Language / Misc / Extensions) overlaid on baked frames
  V(P4, 1720, 435, { anchor: 'center', size: 48, fill: C.dark, bind: () => t('Skin') }),
  V(P4, 2330, 435, { anchor: 'center', size: 48, fill: C.dark, bind: () => t('Language') }),
  V(P4, 1720, 620, { anchor: 'center', size: 48, fill: C.dark, bind: () => t('Misc') }),
  V(P4, 2330, 620, { anchor: 'center', size: 48, fill: C.dark, bind: (l) => `${t('Extensions')} (${l.nPlugins ?? 0})` }),
  B(P4, [1325, 360, 1910, 510], 'skinPicker'),
  B(P4, [1945, 360, 2535, 510], 'langPicker'),
  B(P4, [1325, 545, 1910, 695], 'misc'),
  B(P4, [1945, 545, 2535, 695], 'extPicker'),
  V(P4, 1310, 770, { size: 50, weight: 'bold', fill: C.title, bind: () => t('Documentation') }),
  V(P4, 1780, 915, { anchor: 'center', size: 48, fill: C.dark, bind: () => t('Quickstart guide') }),
  B(P4, [1325, 845, 2535, 985], 'docs'),
  V(P4, 1810, 1230, { anchor: 'center', size: 48, fill: C.dark, bind: () => t('Exit') }),
];

// ---- PRESETS (settings_1) -------------------------------------------------
// settings_1.png boxes (2560-space): left list card [19,211,1293,1376];
// Preview card [1325,211,2528,794]; Description card [1325,804,2528,1213];
// Pick-a-name card [1325,1226,2528,1376]; thermometer +/- at right; piggy bank.
const P1 = ['settings_1'];
// Card top-margins equal the text left-margin (text x=1360, box left=1325 => 35).
const presetEls = [
  // Title flips to "Show all presets" in the eyeball visibility mode.
  V(P1, 55, 225, { size: 50, weight: 'bold', fill: C.title, bind: (l) => (l.showAll ? t('Show all presets') : t('Load a preset')) }),
  // profile list + name field are HTML injected over the left/right cards
  // Preview card [1325,211,2528,794]: title + profile preview graph
  V(P1, 1360, 246, { size: 50, weight: 'bold', fill: C.title, bind: () => t('Preview') }),
  { kind: 'graph', id: 'preset_preview', pages: P1, rect: [1360, 330, 2380, 770] },
  // tapping the preview opens the editor (same as the ADVANCED tab) — Tcl coords
  B(P1, [1330, 220, 2360, 800], 'editThisProfile'),
  // Temperature control on the baked thermometer — exact Tcl coords (de1_skin_settings.tcl):
  // + [2404,192,2590,320], - [2404,600,2590,730], temp text at (2470,600) centre.
  B(P1, [2404, 192, 2590, 320], 'previewTempUp'),
  B(P1, [2404, 600, 2590, 730], 'previewTempDown'),
  V(P1, 2470, 600, { anchor: 'center', size: 44, weight: 'bold', fill: '#7f879a', bind: (l) => `${Math.round(l.previewTemp ?? 92)}°C` }),
  // Description card [1325,804,2528,1213] — scrollable box (finger scrollbar on overflow)
  V(P1, 1360, 839, { size: 50, weight: 'bold', fill: C.title, bind: () => t('Description') }),
  V(P1, 1360, 925, { size: 34, fill: C.muted, width: 1140, wrap: true, scroll: 250, bind: (l) => l.presetDesc || '' }),
  // Pick-a-name card [1325,1226,2528,1376] — the name is an injected text input
  V(P1, 1360, 1249, { size: 44, weight: 'bold', fill: C.title, bind: () => t('Pick a new name to save') }),
  // middle-column baked buttons: trash (delete) / + (new) / eye (visibility) ; piggy (save)
  B(P1, [1120, 300, 1300, 470], 'deletePreset'),
  B(P1, [1120, 530, 1300, 730], 'newPreset'),
  B(P1, [1120, 790, 1300, 980], 'toggleShowAll'),
  B(P1, [2320, 1245, 2540, 1385], 'savePresetName'),
];

// ---- NEW PRESET chooser (settings_3_choices) ------------------------------
// The "+" opens this Pressure / Flow / Advanced chooser; picking one copies the
// current profile as an untitled preset of that kind and opens the editor. Coords
// from the default skin's create_preset page (de1_skin_settings.tcl).
const CH = ['settings_3_choices'];
const createPresetEls = [
  // Font sizes track the Tcl (de1_skin_settings.tcl ~L2011): Helv_20_bold / _15_bold
  // / _10_bold / _7 -> multipliers 37/24/19/14; our Helv_10_bold == 48px, so px = mult*48/19.
  V(CH, 1280, 90, { anchor: 'center', size: 94, weight: 'bold', fill: '#444444', bind: () => t('New Preset') }),
  V(CH, 1280, 650, { anchor: 'center', size: 61, weight: 'bold', fill: '#444444', bind: () => t('What kind of preset?') }),
  V(CH, 520, 910, { anchor: 'center', size: 48, weight: 'bold', fill: '#5a5d75', bind: () => t('Pressure') }),
  V(CH, 1280, 910, { anchor: 'center', size: 48, weight: 'bold', fill: '#5a5d75', bind: () => t('Flow') }),
  V(CH, 2060, 910, { anchor: 'center', size: 48, weight: 'bold', fill: '#5a5d75', bind: () => t('Advanced') }),
  V(CH, 2060, 1060, { anchor: 'center', size: 35, width: 600, wrap: true, justify: 'center', fill: '#5a5d75', bind: () => t('Your existing profile will be automatically copied.') }),
  B(CH, [220, 690, 800, 1190], 'newPressure'),
  B(CH, [980, 690, 1580, 1190], 'newFlow'),
  B(CH, [1760, 690, 2350, 1190], 'newAdvanced'),
  B(CH, [2016, 1430, 2560, 1600], 'choicesCancel'),
  V(CH, 2275, 1520, { anchor: 'center', size: 48, weight: 'bold', fill: '#ffffff', bind: () => t('Cancel') }),
];

// ---- ADVANCED — the editor page tracks the profile type -------------------
// Insight uses settings_2a (Pressure) / 2b (Flow) / 2c (Advanced) as the editor
// background depending on the loaded profile; we pick the matching image and
// overlay a title + a full-area tap zone that opens the working steps editor.
const P2ALL = ['settings_2a', 'settings_2b', 'settings_2c'];
const P2SLIDE = ['settings_2a', 'settings_2b'];   // pressure / flow: per-step sliders
const advEls = [
  V(P2ALL, 60, 245, { size: 50, weight: 'bold', fill: C.title, bind: (l) => `${l.profType || ''} profile: ${l.profTitle || '—'}` }),
  // Temperature control on the baked thermometer (right side of the top card):
  // +/- adjusts every step's temperature (the de1app simple profile has one temp).
  V(P2ALL, 2470, 235, { anchor: 'ne', size: 30, fill: C.muted, bind: () => t('Temp') }),
  V(P2ALL, 2380, 460, { anchor: 'ne', size: 46, weight: 'bold', fill: C.val, bind: (l) => `${Math.round(l.editTemp ?? 92)}°C` }),
  B(P2ALL, [2400, 185, 2560, 380], 'advTempUp'),
  B(P2ALL, [2400, 560, 2560, 745], 'advTempDown'),
  // "open full editor" link (name / add / delete / advanced steps)
  V(P2SLIDE, 60, 320, { size: 30, fill: C.val, bind: () => `✎ ${t('Open full editor')}` }),
  B(P2SLIDE, [40, 300, 760, 375], 'openEditor'),
  // Advanced (2c): step summary + whole-area tap to open the full editor
  V(['settings_2c'], 60, 350, { size: 30, fill: C.muted, width: 900, bind: (l) => l.profSteps || '' }),
  V(['settings_2c'], 60, 300, { size: 30, fill: C.val, bind: () => `${t('Tap to edit steps')} ✎` }),
  B(['settings_2c'], [40, 380, 2540, 1380], 'openEditor'),
];
// profile type -> label + editor background page
function advType(steps) {
  if (!Array.isArray(steps) || !steps.length) return 'Advanced';
  const pumps = new Set(steps.map((s) => s.pump));
  if (pumps.size > 1 || steps.some((s) => s.exit || s.limiter)) return 'Advanced';
  return pumps.has('flow') ? 'Flow' : 'Pressure';
}
const ADV_PAGE = { Pressure: 'settings_2a', Flow: 'settings_2b', Advanced: 'settings_2c' };

const config = {
  imgBase: IMG,
  pages: { settings_1: 'settings_1.png', settings_2a: 'settings_2a.png', settings_2b: 'settings_2b.png',
    settings_2c: 'settings_2c.png', settings_3: 'settings_3.png', settings_4: 'settings_4.png',
    settings_message: 'settings_message.png', settings_3_choices: 'settings_3_choices.png' },
  elements: [...tabBar, ...machineEls, ...appEls, ...presetEls, ...createPresetEls, ...advEls],
};

let host, live, curTab = 'machine', hooks = {}, opened = false;

// Small transient status toast (used by the sub-panels). Was referenced but never
// defined, so every toast() call threw — added here.
let toastT = null;
function toast(msg) {
  if (!host) return;
  let el = host.stage.querySelector('.s2-toast');
  if (!el) { el = document.createElement('div'); el.className = 's2-toast'; host.stage.appendChild(el); }
  el.textContent = msg; el.classList.add('show');
  clearTimeout(toastT); toastT = setTimeout(() => el.classList.remove('show'), 2200);
}

export const isSettingsOpen = () => opened;
export async function settingsGoto(tab) { if (opened) await goto(tab); }       // route-driven tab switch
export function closeSettings() { if (!opened) return; cleanup(); closeOverlay(); opened = false; } // route-driven close (no onClose)

// New-Preset chooser (settings_3_choices) open/close, driven either by taps or by
// the #/settings/presets/new route so a refresh re-shows it. chooserOpen tracks it.
let chooserOpen = false;
export const isChooserOpen = () => chooserOpen;
export function settingsShowChooser() { if (!opened || !host) return; chooserOpen = true; host.show('settings_3_choices'); host.update(live); presetChrome(false); }
export function settingsHideChooser() { if (!opened || !host) return; chooserOpen = false; host.show('settings_1'); host.update(live); presetChrome(true); }

export async function openSettings(startTab = 'machine', h = {}) {
  hooks = h; opened = true;
  const stage = document.createElement('div');
  stage.className = 's2stage';
  stage.innerHTML = '<div class="s2page"></div>';
  openOverlay(stage);
  live = { tab: 'machine', cEspresso: '—', version: '—', coolMin: 30, keepHot: false, fw: '?',
    brightness: 100, devs: '', nPlugins: 0, presetName: '', presetDesc: '', profTitle: '', profSteps: '',
    tabType: t('Advanced').toUpperCase(), tabName: '' };
  host = new PageHost(stage, config, actions, stage.querySelector('.s2page'));
  host.registerGraph('preset_preview', (n) => new MiniChart(n, { series: [{ key: 'p', color: '#00b672' }, { key: 'f', color: '#6c9bff' }, { key: 'temp', color: '#ff7880' }] }));
  api.getWorkflow().then((wf) => { if (wf?.profile) { setTabProfile(wf.profile); host.update(live); } }).catch(() => {});  // seed tab 2 label
  await goto(startTab);
}

async function goto(tab) {
  curTab = tab; live.tab = tab; chooserOpen = false;   // leaving to any tab closes the chooser
  // ADVANCED picks its background from the profile type, so load that first.
  if (tab === 'advanced') await loadAdvanced().catch((e) => logger.warn('adv', e));
  const pageId = tab === 'advanced' ? (live.advPage || 'settings_2c') : PAGES[tab];
  host.show(pageId); host.update(live);
  if (hooks.onTab) hooks.onTab(curTab);   // reflect the tab in the URL immediately (before data loads)
  closeSubPanel();                        // any open Skin/Language/etc. panel belongs to the old tab
  presetChrome(tab === 'presets');        // list + name field belong only on PRESETS
  renderAdvSliders();                     // per-step sliders (shown only on 2a/2b)
  try {
    if (tab === 'machine') await loadMachine();
    else if (tab === 'app') await loadApp();
    else if (tab === 'presets') await loadPresets();
  } catch (e) { logger.warn('settings load', e); }
  host.update(live);
}

async function loadMachine() {
  const [info, ids, presence] = await Promise.all([
    api.getMachineInfo().catch(() => ({})), api.getShotIds().catch(() => []), api.getPresence().catch(() => ({})),
  ]);
  live.cEspresso = (ids || []).length;
  live.version = `API v${info.version ?? '?'} · model ${info.model ?? '?'} · ${info.serialNumber ?? '?'} · GHC ${info.GHC ? 'yes' : 'no'}`;
  live.fw = info.version ?? '?';
  live.coolMin = presence.sleepTimeoutMinutes ?? 30;
  live.keepHot = presence.userPresenceEnabled === false;
  live._presence = presence;
}
async function loadApp() {
  const [devices, display, plugins, info] = await Promise.all([
    api.getDevices().catch(() => []), api.getDisplayState().catch(() => ({})), api.getPlugins().catch(() => []), api.getAppInfo().catch(() => ({})),
  ]);
  live.brightness = typeof display.brightness === 'number' ? display.brightness : 100;
  live.nPlugins = (plugins || []).length;
  live.devs = (devices || []).map((d) => `${d.name || d.id} (${d.state})`).join('   ·   ') || 'no devices';
  live.appVer = info.fullVersion ? `Decent.app ${info.fullVersion}` : 'version unknown';
}
async function loadPresets() {
  const [rows, wf] = await Promise.all([api.getProfiles('?includeHidden=true').catch(() => []), api.getWorkflow().catch(() => ({}))]);
  const all = (rows || []).map((r) => ({ id: r.id, vis: r.visibility || 'visible', isDefault: !!r.isDefault, p: r.profile || {} }))
    .filter((r) => r.vis !== 'deleted').sort((a, b) => (a.p.title || '').localeCompare(b.p.title || ''));
  live._allPresets = all;                                   // all (for the eyeball visibility mode)
  live._presets = all.filter((r) => r.vis === 'visible');   // only visible (normal list)
  const cur = live._presets.find((i) => i.p.title === wf?.profile?.title) || live._presets[0];
  selectPreset(cur);
  renderPresetList();
}
async function loadAdvanced() {
  const wf = await api.getWorkflow().catch(() => ({}));
  const steps = wf?.profile?.steps || [];
  live.profTitle = wf?.profile?.title || 'Untitled';
  live.profType = advType(steps);
  live.advPage = ADV_PAGE[live.profType];
  live._advProfile = structuredClone(wf?.profile || { steps: [] });   // mutable copy the sliders edit
  live.editTemp = steps[0]?.temperature ?? 92;
  setTabProfile(wf?.profile);
  live.profSteps = steps.map((s, i) => `${i + 1}. ${s.name || s.pump}  —  ${s.pump === 'flow' ? s.flow + ' mL/s' : s.pressure + ' bar'} · ${s.seconds}s · ${s.temperature}°C`).join('\n');
}

// Per-step interactive sliders injected over the three lower cards of settings_2a
// (pressure) / 2b (flow). Each step gets a value slider (pressure/flow) + a
// seconds slider; dragging live-updates the workflow. Advanced (2c) profiles keep
// the whole-card tap-to-open-editor instead (they are too varied for fixed rows).
let advSaveT = null;
function saveAdv() { clearTimeout(advSaveT); advSaveT = setTimeout(() => api.updateWorkflow({ profile: live._advProfile }).catch((e) => logger.warn('adv save', e)), 300); }
function advSlidersVisible() { return curTab === 'advanced' && P2SLIDE.includes(live.advPage); }
function renderAdvSliders() {
  if (!host) return;
  let box = host.page.querySelector('.adv-sliders');
  if (!box) { box = document.createElement('div'); box.className = 'adv-sliders'; host.page.appendChild(box); }
  const on = advSlidersVisible();
  box.style.display = on ? 'flex' : 'none';
  if (!on) return;
  box.innerHTML = '';
  const isFlow = live.advPage === 'settings_2b';
  const vkey = isFlow ? 'flow' : 'pressure', vmax = isFlow ? 8 : 12, unit = isFlow ? ' mL/s' : ' bar';
  const steps = live._advProfile?.steps || [];
  steps.forEach((s, i) => {
    const cur = (s[vkey] ?? (isFlow ? s.flow : s.pressure)) || 0;
    const row = spEl('div', 'adv-srow');
    row.appendChild(spEl('div', 'adv-slabel', `${i + 1}. ${s.name || s.pump}`));
    const mkSlider = (label, val, min, max, step, suffix, onIn) => {
      const col = spEl('div', 'adv-scol'); col.appendChild(spEl('span', 'adv-scap', label));
      const r = document.createElement('input'); r.type = 'range'; r.min = min; r.max = max; r.step = step; r.value = val; r.className = 'adv-range';
      const b = spEl('b', 'adv-sval', (+val).toFixed(step < 1 ? 1 : 0) + suffix);
      r.addEventListener('input', () => { const v = parseFloat(r.value); b.textContent = v.toFixed(step < 1 ? 1 : 0) + suffix; onIn(v); saveAdv(); });
      col.appendChild(r); col.appendChild(b); return col;
    };
    row.appendChild(mkSlider(isFlow ? t('Flow') : t('Pressure'), cur, 0, vmax, 0.1, unit, (v) => { s[vkey] = v; s.pump = isFlow ? 'flow' : 'pressure'; }));
    row.appendChild(mkSlider(t('Seconds'), s.seconds ?? 0, 0, 60, 1, ' s', (v) => { s.seconds = v; }));
    box.appendChild(row);
  });
}

// Profile preview curve, identical in shape to the espresso-tab chart: pressure on
// the green line where pressure-controlled, flow on the blue line where flow-
// controlled, and at a pump handoff the outgoing line drops to 0 while the
// incoming line rises from 0 (nulls break the non-controlled line).
function presetPreviewBuf(steps) {
  const out = { t: [], p: [], f: [], temp: [], w: [] };
  if (!Array.isArray(steps)) return out;
  // push a temperature/10 sample alongside every (t,p,f) so temp shares the chart
  // (a 90°C step reads as 9 on the 0-12 scale).
  const pushT = (temp) => out.temp.push(temp != null ? +temp / 10 : null);
  const draw = []; let sp = null, sf = null;
  for (const s of steps) {
    const dur = Math.max(0, +s.seconds || 0);
    if (dur === 0) { if (s.pump === 'pressure') sp = +s.pressure; else sf = +s.flow; continue; }
    draw.push({ s, dur });
  }
  let clock = 0, prevP = sp, prevF = sf;
  for (let i = 0; i < draw.length; i++) {
    const { s, dur } = draw[i], prev = draw[i - 1], next = draw[i + 1];
    const smooth = s.transition === 'smooth', handoffIn = prev && prev.s.pump !== s.pump, temp = +s.temperature;
    if (s.pump === 'pressure') {
      const v = +s.pressure, from = smooth && prevP != null ? prevP : v;
      if (handoffIn) { out.t.push(clock); out.p.push(0); out.f.push(null); pushT(temp); }
      out.t.push(clock, clock + dur); out.p.push(from, v); out.f.push(null, null); pushT(temp); pushT(temp);
      prevP = v;
      if (next && next.s.pump !== 'pressure') { out.t.push(clock + dur); out.p.push(0); out.f.push(null); pushT(temp); }
    } else {
      const v = +s.flow, from = smooth && prevF != null ? prevF : v;
      if (handoffIn) { out.t.push(clock); out.f.push(0); out.p.push(null); pushT(temp); }
      out.t.push(clock, clock + dur); out.f.push(from, v); out.p.push(null, null); pushT(temp); pushT(temp);
      prevF = v;
      if (next && next.s.pump !== 'flow') { out.t.push(clock + dur); out.f.push(0); out.p.push(null); pushT(temp); }
    }
    clock += dur;
  }
  return out;
}
function renderPreview() { const g = host && host.graphs.preset_preview; if (g) g.render(presetPreviewBuf(live._selSteps || [])); }
// Tab 2 label reflects the profile being viewed/edited (type + name).
function setTabProfile(profile) {
  const steps = profile?.steps || [];
  live.tabType = (advType(steps) || 'Advanced').toUpperCase();
  // tab-2 name drops any "Category/…" prefix ("Cleaning/Forward Flush x5" -> "Forward Flush x5")
  live.tabName = (profile?.title || '').split('/').pop().trim();
}
// Tapping a preset loads it: it's sent to the DE1 (workflow) and becomes the
// profile the ADVANCED editor edits. Debounced so rapid list taps don't spam.
let selLoadT = null;
function loadSelectedToWorkflow() {
  clearTimeout(selLoadT);
  selLoadT = setTimeout(() => {
    if (!live._sel) return;
    api.updateWorkflow({ profile: { ...live._sel.p, steps: live._selSteps || live._sel.p.steps } })
      .then(() => window.dispatchEvent(new Event('insight-workflow-changed')))   // main app re-reads the workflow
      .catch((e) => logger.warn('load sel', e));
  }, 250);
}
// Open the ADVANCED editor for the profile currently being viewed. From PRESETS
// the selected preset (with any temperature edits) is loaded into the workflow
// first, so the editor edits exactly what you were previewing.
async function openAdvancedForSelected() {
  if (curTab === 'presets' && live._sel) {
    try { await api.updateWorkflow({ profile: { ...live._sel.p, steps: live._selSteps || live._sel.p.steps } }); } catch (e) { logger.warn('load sel', e); }
  }
  goto('advanced');
}
function selectPreset(it) {
  live._sel = it; live.presetName = it ? (it.p.title || '') : '';
  live.presetDesc = it ? (it.p.notes || '(no description)') : '';
  live._selSteps = it ? structuredClone(it.p.steps || []) : [];      // working copy the temp buttons edit
  live.previewTemp = live._selSteps[0]?.temperature ?? 92;
  if (it) { setTabProfile(it.p); loadSelectedToWorkflow(); }
  host && host.update(live);
  const inp = host && host.page.querySelector('.s2-name-input'); if (inp) inp.value = live.presetName;
  renderPreview();
}
// Temperature +/- adjusts every step of the previewed profile by 1°C (working copy);
// the chart + the displayed temperature update live. Persisted only on save (piggy).
function previewTempAdjust(d) {
  if (!live._selSteps || !live._selSteps.length) return;
  live._selSteps.forEach((s) => { s.temperature = Math.min(105, Math.max(1, (+s.temperature || 92) + d)); });
  live.previewTemp = live._selSteps[0].temperature;
  host.update(live); renderPreview();
}
// Injected text input for "Pick a new name to save"; the piggy tap zone saves it.
function ensureNameInput() {
  let inp = host.page.querySelector('.s2-name-input');
  if (!inp) {
    inp = document.createElement('input'); inp.type = 'text'; inp.className = 's2-name-input';
    host.page.appendChild(inp); inp.value = live.presetName || '';
  }
  return inp;
}
// Show/hide the injected PRESETS chrome (list + name field) together.
function presetChrome(on) {
  if (!host) return;
  const d = on ? 'block' : 'none';
  const s = host.page.querySelector('.s2-preset-scroll'); if (s) s.style.display = d;
  const n = host.page.querySelector('.s2-name-input'); if (n) n.style.display = d;
}
// Split "Category / Sub" titles so a category header shows once with bulleted
// sub-items beneath it (mirrors the Tcl A-Flow / D-Flow grouping).
const splitTitle = (t0) => { const i = (t0 || '').indexOf('/'); return i < 0 ? null : { cat: t0.slice(0, i).trim(), sub: t0.slice(i + 1).trim() }; };
function renderPresetList() {
  const pageEl = host.page; let box = pageEl.querySelector('.s2-preset-scroll');
  if (!box) { box = document.createElement('div'); box.className = 's2-preset-scroll'; pageEl.appendChild(box); }
  box.style.display = curTab === 'presets' ? 'block' : 'none';
  box.innerHTML = '';
  ensureNameInput();
  if (live.showAll) {                                       // eyeball mode: every profile + a visibility checkbox
    (live._allPresets || []).forEach((it) => {
      const row = spEl('label', 's2-preset-check');
      const cb = document.createElement('input'); cb.type = 'checkbox'; cb.checked = it.vis === 'visible';
      cb.addEventListener('change', () => {
        const v = cb.checked ? 'visible' : 'hidden'; it.vis = v;
        api.setProfileVisibility(it.id, v).then(() => toast('Saved')).catch((e) => { logger.warn('vis', e); toast('Failed'); cb.checked = !cb.checked; it.vis = cb.checked ? 'visible' : 'hidden'; });
      });
      row.appendChild(cb); row.appendChild(spEl('span', 's2-check-name', it.p.title || 'Untitled'));
      box.appendChild(row);
    });
    return;
  }
  let lastCat = null;                                       // normal mode: visible only, grouped by "/"
  (live._presets || []).forEach((it) => {
    const title = it.p.title || 'Untitled', parts = splitTitle(title);
    if (parts) {
      if (parts.cat !== lastCat) { box.appendChild(spEl('div', 's2-preset-cat', parts.cat)); lastCat = parts.cat; }
      const b = spEl('button', 's2-preset-row sub' + (it === live._sel ? ' sel' : ''), '– ' + parts.sub);
      b.addEventListener('click', () => { selectPreset(it); renderPresetList(); }); box.appendChild(b);
    } else {
      lastCat = null;
      const b = spEl('button', 's2-preset-row' + (it === live._sel ? ' sel' : ''), title);
      b.addEventListener('click', () => { selectPreset(it); renderPresetList(); }); box.appendChild(b);
    }
  });
}

const num = (title, key, min, max, step, apply) => {
  import('./numpad.js').then(({ openNumpad }) => openNumpad({ title, value: live[key] ?? min, min, max, step, bigStep: step * 10, decimals: 0, onOk: (v) => { live[key] = v; host.update(live); apply(v); } }));
};

// ---- sub-dialogs (Skin / Language / Extensions / Firmware / Misc / Calibrate) ----
// Image-backed on settings_message.png (the Tcl generic dialog frame): title +
// baked Ok are PageHost elements; the scrollable content is HTML injected into
// the white panel region (2560-space, scales with the page).
let dialogReturn = null;
function subPanel(title, build) {
  closeSubPanel();
  dialogReturn = curTab === 'advanced' ? (live.advPage || 'settings_2c') : PAGES[curTab];
  live.dialogTitle = t(title);
  host.show('settings_message'); host.update(live);
  const sl = host.page.querySelector('.adv-sliders'); if (sl) sl.style.display = 'none';   // hide editor sliders behind the modal
  const content = document.createElement('div'); content.className = 's2-dialog-content';
  host.page.appendChild(content);
  build(content);
}
// Remove the dialog content (navigation is left to the caller: dialogOk returns
// to the origin page; goto()/cleanup() move elsewhere themselves).
function closeSubPanel() {
  if (!host) return;
  const c = host.page.querySelector('.s2-dialog-content');
  if (c) c.remove();
  dialogReturn = null;
}
function dialogClose() {
  const r = dialogReturn; closeSubPanel();
  host.show(r || PAGES[curTab] || 'settings_3'); host.update(live);
  presetChrome(curTab === 'presets');
  renderAdvSliders();   // restore editor sliders if we returned to 2a/2b
}
const spEl = (tag, cls, txt) => { const n = document.createElement(tag); if (cls) n.className = cls; if (txt != null) n.textContent = txt; return n; };

async function skinPanel(body) {
  body.appendChild(spEl('p', 's2-sp-sub', 'Loading skins from reaprime…'));
  const [skins, def] = await Promise.all([api.getSkins().catch(() => []), api.getDefaultSkin().catch(() => ({}))]);
  body.innerHTML = '';
  const curId = def?.id;
  (skins || []).forEach((s) => {
    const row = spEl('button', 's2-sp-row' + (s.id === curId ? ' sel' : ''));
    const col = spEl('div'); col.appendChild(spEl('div', 's2-sp-name', s.name || s.id));
    col.appendChild(spEl('div', 's2-sp-sub', `${s.id}  ·  v${s.version || '?'}${s.id === curId ? '  ·  current' : ''}`));
    row.appendChild(col);
    row.addEventListener('click', () => api.setDefaultSkin(s.id)
      .then(() => { toast(`Skin set to ${s.name || s.id}`); subPanel('Skin', skinPanel); })
      .catch((e) => { logger.warn('setSkin', e); toast('Set skin failed'); }));
    body.appendChild(row);
  });
  const upd = spEl('button', 's2-sp-btn grey', 'Update skins from source');
  upd.addEventListener('click', () => { toast('Updating…'); api.updateSkins().then((r) => toast(r.ok ? 'Skins updated' : 'Update failed')).catch(() => toast('Update failed')); });
  body.appendChild(upd);
  body.appendChild(spEl('p', 's2-sp-sub', 'reaprime /webui/skins — switching sets the gateway default skin (takes effect on the tablet).'));
}
// DE1 firmware lives as a single de1plus/fw/bootfwupdate.dat; its version is a
// little-endian u32 at byte offset 8 of the file header (de1app firmware_file_spec:
// CheckSum, BoardMarker, Version, … each u32). We read just the header, compare to
// the connected machine's version, and offer download+upload if GitHub is newer.
const FW_URL = 'https://raw.githubusercontent.com/decentespresso/de1app/main/de1plus/fw/bootfwupdate.dat';
async function githubFwVersion() {
  const r = await fetch(FW_URL, { headers: { Range: 'bytes=0-15' } });   // header only (Range; falls back to full 200)
  if (!r.ok) throw new Error('HTTP ' + r.status);
  const dv = new DataView(await r.arrayBuffer());
  return dv.getUint32(8, true);   // Version field, little-endian
}
function firmwarePanel(body) {
  const cur = parseInt(live.fw, 10) || 0;
  body.appendChild(spEl('p', 's2-sp-name', `Current machine firmware: v${live.fw ?? '?'}`));

  // --- GitHub check + auto download/upload (John's todo) ---
  const ghRow = spEl('div'); ghRow.style.margin = '10px 0 24px';
  const checkBtn = spEl('button', 's2-sp-btn grey', 'Check GitHub for newer firmware');
  const result = spEl('p', 's2-sp-sub', ''); result.style.margin = '14px 0';
  const dlBtn = spEl('button', 's2-sp-btn', 'Download newest & upload'); dlBtn.style.display = 'none';
  async function runFwCheck() {
    checkBtn.textContent = 'Checking GitHub…'; checkBtn.disabled = true;
    try {
      const gh = await githubFwVersion();
      const rel = gh > cur ? `NEWER available (v${gh} > your v${cur})` : gh === cur ? `you are up to date (v${gh})` : `GitHub is older (v${gh} < your v${cur})`;
      result.textContent = `GitHub firmware: v${gh} — ${rel}`;
      dlBtn.style.display = gh > cur ? '' : 'none'; dlBtn.dataset.gh = gh;
    } catch (e) { result.textContent = 'GitHub check failed: ' + e.message; logger.warn('gh fw', e); }
    checkBtn.textContent = 'Re-check GitHub'; checkBtn.disabled = false;
  }
  checkBtn.addEventListener('click', runFwCheck);
  dlBtn.addEventListener('click', async () => {
    if (!confirm(`Download firmware v${dlBtn.dataset.gh} from GitHub and upload it to the DE1? The machine will restart.`)) return;
    dlBtn.textContent = 'Downloading…';
    try {
      const buf = await fetch(FW_URL).then((r) => r.arrayBuffer());
      dlBtn.textContent = 'Uploading to DE1…';
      const r = await api.uploadFirmware(buf);
      toast(r.ok ? 'Firmware uploaded — machine restarting' : 'Upload failed');
    } catch (e) { logger.warn('fw dl', e); toast('Download/upload failed'); }
    dlBtn.textContent = 'Download newest & upload';
  });
  ghRow.appendChild(checkBtn); ghRow.appendChild(result); ghRow.appendChild(dlBtn);
  body.appendChild(ghRow);
  // Auto-check GitHub on open (John's todo: auto-compare vs the connected DE1);
  // if newer, the one-tap "Download newest & upload" appears — the actual flash
  // stays confirm-gated (we never silently re-flash the machine).
  checkBtn.textContent = 'Re-check GitHub';
  result.textContent = 'Checking GitHub for newer firmware…';
  setTimeout(() => runFwCheck(), 80);

  // --- manual file upload ---
  body.appendChild(spEl('p', 's2-sp-sub', 'Or upload a firmware file manually (.dat/.bin). The machine restarts when the update completes.'));
  const inp = document.createElement('input'); inp.type = 'file'; inp.accept = '.dat,.bin,.fw,.dfu'; inp.style.cssText = 'display:block;margin:14px 0;font-size:28px;';
  const btn = spEl('button', 's2-sp-btn grey', 'Upload firmware'); btn.disabled = true; btn.style.opacity = '.5';
  inp.addEventListener('change', () => { btn.disabled = !inp.files.length; btn.style.opacity = inp.files.length ? '1' : '.5'; });
  btn.addEventListener('click', () => {
    if (!inp.files.length) return;
    if (!confirm(`Upload ${inp.files[0].name} to the DE1? The machine will restart.`)) return;
    toast('Uploading firmware…');
    api.uploadFirmware(inp.files[0]).then((r) => toast(r.ok ? 'Firmware uploaded — machine restarting' : 'Upload failed')).catch((e) => { logger.warn('fw', e); toast('Upload failed'); });
  });
  body.appendChild(inp); body.appendChild(btn);
}
// Calibrate — REA exposes flow multipliers (/settings) and quick-adjust machine
// values (/machine/settings); sensor calibration (temp/pressure/steam-temp/
// voltage) is NOT writable (same limitation Streamline notes).
// A columnar calibration table (Measurement | Current value | Adjust), mirroring
// the Tcl Calibrate page's tabular layout. Each row edits + saves inline.
function calTable(body, title, rows) {
  const wrap = spEl('div', 's2-cal');
  const head = spEl('div', 's2-cal-row s2-cal-h');
  head.appendChild(spEl('div', 's2-cal-cell', title));
  head.appendChild(spEl('div', 's2-cal-cell num', 'Value'));
  head.appendChild(spEl('div', 's2-cal-cell num', 'Adjust'));
  wrap.appendChild(head);
  rows.forEach(([label, val, min, max, step, save]) => {
    const r = spEl('div', 's2-cal-row');
    r.appendChild(spEl('div', 's2-cal-cell', label));
    const inp = document.createElement('input'); inp.type = 'number'; inp.value = val; inp.min = min; inp.max = max; inp.step = step; inp.className = 's2-cal-input';
    const commit = () => { let v = parseFloat(inp.value); if (Number.isNaN(v)) return; v = Math.min(max, Math.max(min, v)); inp.value = v;
      Promise.resolve(save(v)).then(() => toast('Saved')).catch((e) => { logger.warn('cal save', e); toast('Save failed'); }); };
    inp.addEventListener('change', commit);
    const stepper = spEl('div', 's2-cal-stepper');
    const mk = (txt, d) => { const b = spEl('button', 's2-cal-step', txt); b.addEventListener('click', () => { inp.value = (Math.round((parseFloat(inp.value || 0) + d) / step) * step).toFixed(String(step).split('.')[1]?.length || 0); commit(); }); return b; };
    stepper.appendChild(mk('−', -step)); stepper.appendChild(mk('+', step));
    const cell = spEl('div', 's2-cal-cell num'); cell.appendChild(inp);
    r.appendChild(cell); r.appendChild(stepper); wrap.appendChild(r);
  });
  body.appendChild(wrap);
}
async function calibratePanel(body) {
  body.appendChild(spEl('p', 's2-sp-sub', 'Loading calibration settings…'));
  const [rea, machine] = await Promise.all([api.getReaSettings().catch(() => ({})), api.getMachineSettings().catch(() => ({}))]);
  body.innerHTML = '';
  calTable(body, 'Flow multipliers', [
    ['Weight flow', rea.weightFlowMultiplier ?? 1, 0.1, 3, 0.05, (v) => { rea.weightFlowMultiplier = v; return api.setReaSettings(rea); }],
    ['Volume flow (s)', rea.volumeFlowMultiplier ?? 0.3, 0, 2, 0.05, (v) => { rea.volumeFlowMultiplier = v; return api.setReaSettings(rea); }],
    ['Hot-water flow', rea.hotWaterFlowMultiplier ?? 0.3, 0, 2, 0.05, (v) => { rea.hotWaterFlowMultiplier = v; return api.setReaSettings(rea); }],
  ]);
  calTable(body, 'Machine quick-adjust', [
    ['Tank / preheat temp (°C)', machine.tankTemp ?? 20, 0, 60, 1, (v) => { machine.tankTemp = v; return api.setMachineSettings(machine); }],
    ['Fan threshold (°C)', machine.fan ?? 50, 30, 60, 1, (v) => { machine.fan = v; return api.setMachineSettings(machine); }],
    ['Flush temp (°C)', machine.flushTemp ?? 25, 0, 95, 1, (v) => { machine.flushTemp = v; return api.setMachineSettings(machine); }],
  ]);
  const gfc = spEl('button', 's2-sp-btn', 'Graphical Flow Calibrator →');
  gfc.addEventListener('click', () => { closeSubPanel(); openGFC(); });
  body.appendChild(gfc);
  body.appendChild(spEl('p', 's2-sp-note', 'Temperature / pressure / steam-temperature / fan / voltage sensor calibration is NOT writable via reaprime — the gateway (and, per Streamline, the current firmware API) exposes no write for these. Only the flow multipliers and quick-adjust machine values above are settable here; deeper calibration must be done in the native Decent.app.'));
}
async function extPanel(body) {
  const plugins = await api.getPlugins().catch(() => []);
  if (!plugins.length) body.appendChild(spEl('p', 's2-sp-sub', 'No plugins reported.'));
  plugins.forEach((pl) => {
    const row = spEl('div', 's2-sp-row');
    const col = spEl('div'); col.appendChild(spEl('div', 's2-sp-name', pl.name || pl.id));
    col.appendChild(spEl('div', 's2-sp-sub', pl.author || pl.id)); row.appendChild(col);
    const on = pl.enabled !== false;
    const t = spEl('button', 's2-sp-btn' + (on ? '' : ' grey'), on ? 'Enabled' : 'Disabled'); t.style.marginLeft = 'auto';
    t.addEventListener('click', () => { const fn = t.textContent === 'Enabled' ? api.disablePlugin : api.enablePlugin;
      fn(pl.id).then(() => { const nowOn = t.textContent !== 'Enabled'; t.textContent = nowOn ? 'Enabled' : 'Disabled'; t.classList.toggle('grey', !nowOn); toast('Saved'); }).catch(() => toast('Failed')); });
    row.appendChild(t); body.appendChild(row);
  });
}
function langPanel(body) {
  const cur = currentLangName();
  LANGUAGES.forEach((L) => { const r = spEl('button', 's2-sp-row' + (L.name === cur ? ' sel' : ''), ''); r.appendChild(spEl('div', 's2-sp-name', L.name));
    r.addEventListener('click', () => { setLang(L.name); toast('Saved'); langPanel((body.innerHTML = '', body)); }); body.appendChild(r); });
  body.appendChild(spEl('p', 's2-sp-note', 'Translations come from the de1app GUI translation sheet (src/i18n/de1-translations.csv, 32 languages) — the same source the Streamline skin uses.'));
}
function miscPanel(body) {
  const mk = (label, on, fn) => { const r = spEl('div', 's2-sp-row'); r.appendChild(spEl('div', 's2-sp-name', label));
    const t = spEl('button', 's2-sp-btn' + (on ? '' : ' grey'), on ? 'On' : 'Off'); t.style.marginLeft = 'auto';
    t.addEventListener('click', () => { const now = t.textContent === 'Off'; t.textContent = now ? 'On' : 'Off'; t.classList.toggle('grey', !now); fn(now); }); r.appendChild(t); body.appendChild(r); };
  mk('Fahrenheit (off = Celsius)', localStorage.getItem('units') === 'f', (v) => localStorage.setItem('units', v ? 'f' : 'c'));
  mk('Insight Dark theme', localStorage.getItem('theme') === 'dark', (v) => { const th = v ? 'dark' : 'light'; localStorage.setItem('theme', th);
    if (th === 'dark') document.documentElement.dataset.theme = 'dark'; else delete document.documentElement.dataset.theme;
    window.dispatchEvent(new Event('insight-themechange')); });
  mk('Screensaver clock', localStorage.getItem('insight_saver_clock') === '1', (v) => localStorage.setItem('insight_saver_clock', v ? '1' : '0'));
}

// New preset: copy the current profile (reaprime models pressure/flow/advanced as
// one steps[], so the "kind" mainly selects the editor background), blank the
// title, seed it as the workflow profile, then open the steps editor to rename +
// tune. Save in the editor persists it as a new profile.
async function createPreset(kind) {
  chooserOpen = false; if (hooks.onChooser) hooks.onChooser(false);   // picking a kind leaves the chooser URL
  try {
    const wf = await api.getWorkflow().catch(() => ({}));
    const base = wf?.profile || {};
    const profile = { ...base, title: t('Untitled') };
    delete profile.id;
    await api.updateWorkflow({ profile });
    live._newType = kind;
  } catch (e) { logger.warn('newPreset', e); }
  openProfileEditor(() => goto('advanced'));
}

const actions = {
  navPresets: () => goto('presets'), navAdvanced: () => openAdvancedForSelected(), navMachine: () => goto('machine'), navApp: () => goto('app'),
  dialogOk: () => dialogClose(),
  // New-preset chooser
  newPreset: () => { settingsShowChooser(); if (hooks.onChooser) hooks.onChooser(true); },
  choicesCancel: () => { settingsHideChooser(); if (hooks.onChooser) hooks.onChooser(false); },
  // Trash: default (built-in) profiles are HIDDEN, not deleted (you can't delete a
  // default); user profiles are deleted. No browser confirm dialog.
  deletePreset: async () => {
    const sel = live._sel; if (!sel) { toast('No preset selected'); return; }
    try {
      if (sel.isDefault) { await api.setProfileVisibility(sel.id, 'hidden'); toast(`Hid "${sel.p.title || 'Untitled'}"`); }
      else { await api.deleteProfile(sel.id); toast(`Deleted "${sel.p.title || 'Untitled'}"`); }
      await loadPresets();
    } catch (e) { logger.warn('del preset', e); toast('Failed'); }
  },
  // Tap the preview chart (or the ADVANCED tab) -> edit the selected profile.
  editThisProfile: () => openAdvancedForSelected(),
  previewTempUp: () => previewTempAdjust(+1),
  previewTempDown: () => previewTempAdjust(-1),
  savePresetName: async () => {
    const inp = host.page.querySelector('.s2-name-input');
    const name = ((inp && inp.value) || live.presetName || '').trim();
    const sel = live._sel;
    if (!sel || !name) { toast('Type a name first'); return; }
    const steps = live._selSteps || sel.p.steps || [];
    const edited = JSON.stringify(steps) !== JSON.stringify(sel.p.steps || []);
    try {
      if (edited) {
        // Content changed (e.g. temperature): POST a new profile (reaprime content-
        // hashes, so distinct content => distinct id). If we branched off a default,
        // hide that default — the Streamline "new profile replaces the default" flow.
        const created = await api.saveProfile({ ...sel.p, title: name, steps });
        if (sel.isDefault && created && created.id && created.id !== sel.id) await api.setProfileVisibility(sel.id, 'hidden');
        toast(`Saved "${name}"`);
      } else if (!sel.isDefault) {
        await api.updateProfile(sel.id, { ...sel.p, title: name });   // pure rename of a user profile
        toast(`Renamed to "${name}"`);
      } else {
        // Unedited default: reaprime can't make an identical-content copy under a new
        // name. Nudge the user to change something (the temperature buttons will do it).
        toast('Adjust the profile (e.g. temperature) to save a default under a new name');
        return;
      }
      await loadPresets();
    } catch (e) { logger.warn('save preset', e); toast('Save failed'); }
  },
  toggleShowAll: () => {
    live.showAll = !live.showAll;
    // returning to the normal list: recompute the visible subset (visibility may
    // have been toggled in show-all mode)
    if (!live.showAll) live._presets = (live._allPresets || []).filter((r) => r.vis === 'visible');
    host.update(live); renderPresetList();
  },
  newPressure: () => createPreset('Pressure'), newFlow: () => createPreset('Flow'), newAdvanced: () => createPreset('Advanced'),
  skinPicker: () => subPanel('Skin', skinPanel), langPicker: () => subPanel('Language', langPanel),
  extPicker: () => subPanel('Extensions', extPanel), misc: () => subPanel('Misc', miscPanel),
  firmware: () => subPanel('Firmware', firmwarePanel),
  appUpdate: () => { toast('Re-pulling skins from source…'); api.updateSkins().then((r) => toast(r.ok ? 'App/skins updated from source' : 'Update failed')).catch(() => toast('Update failed')); },
  cancel: () => { cleanup(); closeOverlay(); opened = false; if (hooks.onClose) hooks.onClose(); },
  ok: () => { cleanup(); closeOverlay(); opened = false; if (hooks.onClose) hooks.onClose(); },
  // MACHINE
  editCool: () => num('Cool down after (min)', 'coolMin', 5, 240, 5, (v) => api.setPresence({ ...(live._presence || {}), sleepTimeoutMinutes: v }).catch((e) => logger.warn('presence', e))),
  toggleKeepHot: () => { live.keepHot = !live.keepHot; host.update(live); api.setPresence({ ...(live._presence || {}), userPresenceEnabled: !live.keepHot }).catch((e) => logger.warn('presence', e)); },
  clean: () => { if (confirm('Run cleaning cycle?')) openMaintenance('clean'); },
  descale: () => openMaintenance('descale'),
  calibrate: () => subPanel('Calibrate', calibratePanel),
  // APP
  editBrightness: () => num('Screen brightness (%)', 'brightness', 5, 100, 5, (v) => api.setBrightness(v)),
  searchDevices: () => api.scanDevices(false).then(() => setTimeout(() => goto('app'), 800)).catch((e) => logger.warn('scan', e)),
  docs: () => window.open('https://decentespresso.com/learn', '_blank'),
  // PRESETS / ADVANCED
  openEditor: () => openProfileEditor(() => goto('advanced')),
  advTempUp: () => advTemp(+1), advTempDown: () => advTemp(-1),
};
// Temperature +/- on the 2a/2b/2c thermometer sets every step's temperature.
function advTemp(d) {
  if (!live._advProfile) return;
  live.editTemp = Math.min(105, Math.max(80, Math.round((live.editTemp ?? 92) + d)));
  (live._advProfile.steps || []).forEach((s) => { s.temperature = live.editTemp; });
  host.update(live); saveAdv();
}
function cleanup() { closeSubPanel(); if (host) { ['.s2-preset-scroll', '.adv-sliders', '.s2-name-input'].forEach((s) => { const el = host.page.querySelector(s); if (el) el.remove(); }); } }
