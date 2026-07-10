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
import { renderProfileEditor, hideProfileEditor, removeProfileEditor, ppTempAdjust, ppToggleTempSteps, PRESSURE_SPEC, FLOW_SPEC } from './pressure_editor.js';
import { renderAdvancedEditor, hideAdvancedEditor, removeAdvancedEditor } from './advanced_editor.js';
import { parsePressure } from '../config/pressure_profile.js';
import { parseFlow } from '../config/flow_profile.js';
import { setLang, currentLangName, currentLangCode, LANGUAGES, t } from '../modules/i18n.js';
import { logger } from '../modules/logger.js';

const IMG = 'assets/insight/';
// Card titles in the Tcl settings pages are a soft grey-blue (not navy); rows a
// medium grey. Colours sampled from the sstcl screenshots.
// Grey text is Tcl's #7f879a; blue values are #4e85f4 — matching the Tcl skin
// (and the advanced editor's CSS), so all settings pages share one palette.
const C = { title: '#7f879a', label: '#7f879a', val: '#4e85f4', dark: '#2d3046', tabOff: '#7e8496', muted: '#7f879a', na: '#b06a6a' };
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
  V(MODAL, 1293, 1308, { anchor: 'center', size: 52, weight: 'bold', fill: '#fafbff', bind: () => t('Ok') }),
];

// ---- MACHINE (settings_3) -------------------------------------------------
const P3 = ['settings_3'];
const row3 = (y, label, valBind) => [
  V(P3, 60, y, { size: 40, fill: C.label, bind: () => t(label) }),
  V(P3, 1120, y, { anchor: 'ne', size: 40, fill: C.title, bind: valBind }),   // counts in Tcl's grey, not dark ink
];
const machineEls = [
  // Counter card (Tcl: title 55,220; rows Espresso/Steam/Hot water 310/370/430;
  // counts right-aligned at the card's right edge)
  V(P3, 55, 220, { size: 50, weight: 'bold', fill: C.title, bind: () => t('Counter') }),
  ...row3(310, 'Espresso', (l) => String(l.cEspresso ?? '—')),
  ...row3(370, 'Steam', () => '—'),
  ...row3(430, 'Hot water', () => '—'),
  // Version card (Tcl: title 55,544; version string 55,616)
  V(P3, 55, 544, { size: 50, weight: 'bold', fill: C.title, bind: () => t('Version') }),
  V(P3, 55, 616, { size: 36, fill: C.muted, bind: (l) => l.version || '—' }),
  // Energy saver card (reaprime equivalent of the Tcl scheduler; fills the 3rd left box)
  V(P3, 55, 775, { size: 50, weight: 'bold', fill: C.title, bind: () => t('Energy saver') }),
  V(P3, 60, 880, { size: 40, fill: C.label, bind: (l) => `${t('Cool down after:')} ${l.coolMin ?? 30} ${t('min')}` }),
  B(P3, [40, 850, 1140, 960], 'editCool'),
  V(P3, 180, 1040, { size: 44, fill: C.val, bind: () => t('Keep hot') }),   // switch drawn to its left in renderKeepHotSched
  B(P3, [40, 1010, 1140, 1110], 'toggleKeepHot'),
  // Maintenance card — labels overlaid on the baked icon buttons (Tcl: title 1304,220;
  // Read-Manual link 2520,220 ne; button labels centred at 1640/2290 x 420/610, bold)
  V(P3, 1304, 220, { size: 50, weight: 'bold', fill: C.title, bind: () => t('Maintenance') }),
  V(P3, 2520, 220, { anchor: 'ne', size: 38, fill: C.val, bind: () => `[${t('Read Manual')}: ${t('Cleaning')}]` }),
  B(P3, [1300, 210, 2560, 280], 'readManual'),   // opens the language-specific quickstart manual
  V(P3, 1640, 420, { anchor: 'center', size: 48, weight: 'bold', fill: '#ffffff', bind: () => t('Clean') }),
  V(P3, 2290, 420, { anchor: 'center', size: 48, weight: 'bold', fill: '#ffffff', bind: () => t('Descale') }),
  V(P3, 1640, 610, { anchor: 'center', size: 48, weight: 'bold', fill: '#ffffff', bind: () => t('Calibrate') }),
  V(P3, 2290, 610, { anchor: 'center', size: 48, weight: 'bold', fill: '#ffffff', bind: () => t('Transport') }),
  B(P3, [1280, 310, 1900, 510], 'clean'),
  B(P3, [1910, 310, 2540, 510], 'descale'),
  B(P3, [1280, 516, 1900, 720], 'calibrate'),
  B(P3, [1910, 516, 2540, 720], 'transport'),
  // Firmware card (Tcl: title 1304,750; button label centred at 1960,926; button 1280,850..2540,1020)
  V(P3, 1304, 750, { size: 50, weight: 'bold', fill: C.title, bind: () => t('Firmware') }),
  V(P3, 1910, 926, { anchor: 'center', size: 48, weight: 'bold', fill: '#ffffff', bind: (l) => (l.githubFw != null && parseInt(l.fw, 10) === l.githubFw ? t('Firmware up to date') : `v${l.fw ?? '?'} · ${t('Update')}…`) }),
  B(P3, [1280, 850, 2540, 1020], 'firmware'),
  // Water level card (Tcl: title 1304,1080)
  V(P3, 1304, 1080, { size: 50, weight: 'bold', fill: C.title, bind: () => t('Water level') }),
  V(P3, 1304, 1170, { size: 36, fill: C.na, bind: () => 'Not reported by this gateway build' }),
];

// ---- APP (settings_4) -----------------------------------------------------
const P4 = ['settings_4'];
// Coordinates match the Tcl settings_4 page exactly (our settings_4.avif IS that
// asset). Grey titles are #7f879a (C.title); the button labels overlaid on the
// baked lavender buttons are white + bold, like Tcl (Helv_10_bold #FFFFFF).
const appEls = [
  // Update App card (title 50,220; version top-right 1240,226; button label centred 700,416)
  V(P4, 50, 220, { size: 50, weight: 'bold', fill: C.title, bind: () => t('Update app') }),
  V(P4, 1240, 226, { anchor: 'ne', size: 36, fill: C.muted, bind: (l) => l.appVer || 'checking…' }),
  V(P4, 700, 416, { anchor: 'center', size: 48, weight: 'bold', fill: '#ffffff', bind: (l) => l.appUpdateLabel || t('Check for updates') }),
  B(P4, [20, 320, 1250, 526], 'appUpdate'),
  // Screen brightness card (title 50,566; slider 50,660 injected below; value 50,800)
  V(P4, 50, 566, { size: 50, weight: 'bold', fill: C.title, bind: () => t('Screen brightness') }),
  V(P4, 50, 800, { size: 34, fill: C.muted, bind: (l) => `${t('App:')} ${l.brightness ?? 100}%` }),
  // Connect card (title 55,970; Search button 650,960..1260,1070; devices listed below)
  V(P4, 55, 970, { size: 50, weight: 'bold', fill: C.title, bind: () => t('Connect') }),
  V(P4, 955, 1016, { anchor: 'center', size: 40, weight: 'bold', fill: '#ffffff', bind: () => t('Search') }),
  B(P4, [650, 960, 1260, 1070], 'searchDevices'),
  // device columns (Espresso machine | Scale) are injected by renderAppDevices()
  // right column: Skin / Language / Misc / Extensions — white bold labels on the baked buttons
  V(P4, 1656, 416, { anchor: 'center', size: 48, weight: 'bold', fill: '#ffffff', bind: () => t('Skin') }),
  V(P4, 2290, 416, { anchor: 'center', size: 48, weight: 'bold', fill: '#ffffff', bind: () => t('Language') }),
  V(P4, 1656, 616, { anchor: 'center', size: 48, weight: 'bold', fill: '#ffffff', bind: () => t('Misc') }),
  V(P4, 2290, 616, { anchor: 'center', size: 48, weight: 'bold', fill: '#ffffff', bind: () => t('Extensions') }),
  B(P4, [1290, 306, 1900, 510], 'skinPicker'),
  B(P4, [1910, 306, 2530, 510], 'langPicker'),
  B(P4, [1290, 520, 1900, 720], 'misc'),
  B(P4, [1910, 520, 2530, 720], 'extPicker'),
  // Documentation card (title 1310,820; Quickstart button spans the whole box)
  V(P4, 1310, 820, { size: 50, weight: 'bold', fill: C.title, bind: () => t('Documentation') }),
  V(P4, 1900, 980, { anchor: 'center', size: 48, weight: 'bold', fill: '#ffffff', bind: () => t('Quickstart guide') }),
  B(P4, [1290, 860, 2550, 1100], 'docs'),
  // Exit app card (title 1310,1130; Exit button spans the whole box)
  V(P4, 1310, 1130, { size: 50, weight: 'bold', fill: C.title, bind: () => t('Exit app') }),
  V(P4, 1900, 1290, { anchor: 'center', size: 48, weight: 'bold', fill: '#ffffff', bind: () => t('Exit') }),
  B(P4, [1290, 1170, 2550, 1400], 'exitApp'),
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
// settings_2a (pressure) and settings_2b (flow) are now the faithful step editor
// (pressure_editor.js), which owns its own title / temp / chart / sliders — so
// the generic advEls text below is scoped to 2c (Advanced) only. The temp +/-
// and step-temp-toggle tap zones stay on the two step editors.
const P2E = ['settings_2a', 'settings_2b'];   // the two parametric step editors
const P2C = ['settings_2c', 'settings_2c2'];  // the advanced editor's two sub-tabs
const advEls = [
  // pressure/flow step editors: baked thermometer +/- and the per-step-temp toggle
  B(P2E, [2400, 185, 2560, 380], 'advTempUp'),
  B(P2E, [2400, 560, 2560, 745], 'advTempDown'),
  B(P2E, [2400, 380, 2560, 555], 'ppToggleTemps'),
  // Advanced editor: bottom Steps / Limits sub-tab buttons + their labels
  V(P2C, 240, 1485, { anchor: 'center', size: 42, weight: 'bold', fill: C.title, bind: () => t('Steps') }),
  V(P2C, 735, 1485, { anchor: 'center', size: 42, weight: 'bold', fill: C.title, bind: () => t('Limits') }),
  B(P2C, [1, 1410, 495, 1600], 'advTabSteps'),
  B(P2C, [496, 1410, 972, 1600], 'advTabLimits'),
];
// profile type -> label + editor background page. A "simple" pressure/flow
// profile is a (flow-pump) preinfusion followed by a body that's ALL one pump
// type; anything with a mixed body is Advanced. Preinfusion is excluded from the
// body test (the DE1 simple pressure profile is flow-preinfuse + pressure body).
function advType(steps) {
  if (!Array.isArray(steps) || !steps.length) return 'Advanced';
  const body = steps.filter((s) => !/preinf/i.test(s.name || ''));
  const pumps = new Set((body.length ? body : steps).map((s) => s.pump));
  if (pumps.size !== 1) return 'Advanced';
  return pumps.has('flow') ? 'Flow' : 'Pressure';
}
const ADV_PAGE = { Pressure: 'settings_2a', Flow: 'settings_2b', Advanced: 'settings_2c' };

const config = {
  imgBase: IMG,
  pages: { settings_1: 'settings_1.png', settings_2a: 'settings_2a2.png', settings_2b: 'settings_2b2.png',
    settings_2c: 'settings_pages_all.png', settings_2c2: 'settings_2c2.png', settings_3: 'settings_3.png', settings_4: 'settings_4.png',
    settings_message: 'settings_message.png', settings_3_choices: 'settings_3_choices.png' },
  elements: [...tabBar, ...machineEls, ...appEls, ...presetEls, ...createPresetEls, ...advEls],
};

let host, live, curTab = 'machine', hooks = {}, opened = false;
let lastTab = 'machine';   // remembered so the gear reopens the tab you last used
export const settingsLastTab = () => lastTab;

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

// Route-driven: open the profile editor for a named profile (#/settings/presets/
// profile/edit/<name>). Loads that preset onto the workflow, then opens the type-
// matched editor (pressure -> the parametric settings_2a editor). Falls back to
// whatever is already on the workflow when the name isn't found (e.g. a fresh copy).
export async function settingsEditProfile(name) {
  if (!opened || !host) return;
  const want = decodeURIComponent(name || '').trim();
  if (want) {
    try {
      const list = await api.getProfiles().catch(() => []);
      const row = (list || []).find((e) => ((e.profile || e).title || '').trim() === want);
      if (row) await api.updateWorkflow({ profile: row.profile || row });
    } catch (e) { logger.warn('editProfile load', e); }
  }
  await goto('advanced');
}

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
  curTab = tab; live.tab = tab; lastTab = tab; chooserOpen = false;   // remember tab; leaving closes the chooser
  // ADVANCED picks its background from the profile type, so load that first.
  if (tab === 'advanced') await loadAdvanced().catch((e) => logger.warn('adv', e));
  const pageId = tab === 'advanced' ? (live.advPage || 'settings_2c') : PAGES[tab];
  host.show(pageId); host.update(live);
  // settings_2a -> PRESSURE editor, settings_2b -> FLOW editor (spec-driven);
  // settings_2c / settings_2c2 -> the ADVANCED step editor.
  const editSpec = tab === 'advanced' ? (live.advPage === 'settings_2a' ? PRESSURE_SPEC : live.advPage === 'settings_2b' ? FLOW_SPEC : null) : null;
  const advEdit = tab === 'advanced' && (live.advPage === 'settings_2c' || live.advPage === 'settings_2c2');
  // URL: all three step editors deep-link to /presets/profile/edit/<name>.
  if ((editSpec || advEdit) && hooks.onEditProfile) hooks.onEditProfile(live.profTitle);
  else if (hooks.onTab) hooks.onTab(curTab);
  closeSubPanel();                        // any open Skin/Language/etc. panel belongs to the old tab
  presetChrome(tab === 'presets');        // list + name field belong only on PRESETS
  if (editSpec) { renderProfileEditor(host, live, editSpec, saveAdv); hideAdvancedEditor(host); const sl = host.page.querySelector('.adv-sliders'); if (sl) sl.style.display = 'none'; }
  else if (advEdit) { renderAdvancedEditor(host, live, saveAdv); hideProfileEditor(host); const sl = host.page.querySelector('.adv-sliders'); if (sl) sl.style.display = 'none'; }
  else { hideProfileEditor(host); hideAdvancedEditor(host); renderAdvSliders(); }
  try {
    if (tab === 'machine') await loadMachine();
    else if (tab === 'app') await loadApp();
    else if (tab === 'presets') await loadPresets();
  } catch (e) { logger.warn('settings load', e); }
  renderKeepHotSched();      // show the keep-hot sliders on MACHINE only, hide elsewhere
  renderAppDevices();        // show the Bluetooth device list on APP only, hide elsewhere
  renderAppBrightness();     // and the brightness slider
  host.update(live);
}

async function loadMachine() {
  const [info, ids, presence] = await Promise.all([
    api.getMachineInfo().catch(() => ({})), api.getShotIds().catch(() => []), api.getPresence().catch(() => ({})),
  ]);
  live.cEspresso = (ids || []).length;
  live.version = `API v${info.version ?? '?'} · model ${info.model ?? '?'} · ${info.serialNumber ?? '?'} · GHC ${info.GHC ? 'yes' : 'no'}`;
  live.fw = info.version ?? '?';
  // Compare against GitHub's latest so the Firmware button can show "up to date".
  githubFwVersion().then((gh) => { live.githubFw = gh; if (host && curTab === 'machine') host.update(live); }).catch(() => {});
  live.coolMin = presence.sleepTimeoutMinutes ?? 30;
  live.keepHot = presence.userPresenceEnabled === false;
  live._presence = presence;
  loadSched();
  renderKeepHotSched();
}

// ---- Read Manual: language-specific quickstart page (Tcl web_browser links) ----
function manualUrl() {
  const map = {
    de: 'quickstart_de/quickstart_de.html#pf22', fr: 'quickstart_fr/quickstart_fr.html#pf21',
    es: 'quickstart_es/quickstart_es.html#pf21', kr: 'quickstart_kr/quickstart_kr.html#pf21',
    'zh-hans': 'quickstart_zh/quickstart_zh.html#pf21',
  };
  return 'https://decentespresso.com/doc/' + (map[currentLangCode()] || 'quickstart/quickstart.html#pf21');
}
// Documentation "Quickstart Guide" link — language-specific directory (Tcl settings_4).
function quickstartUrl() {
  const map = { de: 'quickstart_de', fr: 'quickstart_fr', es: 'quickstart_es', kr: 'quickstart_kr', 'zh-hans': 'quickstart_zh' };
  return 'https://decentespresso.com/doc/' + (map[currentLangCode()] || 'quickstart') + '/';
}

// ---- Keep-hot daily schedule (Tcl scheduler): two time sliders that appear when
// "Keep hot" is on. reaprime has no wake/sleep scheduler, so the times persist
// client-side. Values are minutes-of-day (0..1439); Tcl uses seconds (step 60).
const SCHED_KEY = 'insight_keephot_sched';
// 12-hour clock: an explicit Misc "AM/PM" choice wins; otherwise fall back to the OS locale.
const is12h = () => {
  const o = localStorage.getItem('insight_ampm');
  if (o === '1') return true; if (o === '0') return false;
  try { return new Intl.DateTimeFormat([], { hour: 'numeric' }).resolvedOptions().hour12 ?? false; } catch (e) { return false; }
};
const fmtHM = (min) => {
  const m = Math.max(0, Math.min(1439, Math.round(min)));
  let h = Math.floor(m / 60); const mm = String(m % 60).padStart(2, '0');
  if (is12h()) { const mer = h >= 12 ? 'PM' : 'AM'; h = h % 12 || 12; return `${h}:${mm} ${mer}`; }
  return `${String(h).padStart(2, '0')}:${mm}`;
};
function loadSched() {
  try { const s = JSON.parse(localStorage.getItem(SCHED_KEY) || '{}'); live.schedWake = s.wake ?? 360; live.schedSleep = s.sleep ?? 1320; }
  catch (e) { live.schedWake = 360; live.schedSleep = 1320; }
}
function saveSched() { try { localStorage.setItem(SCHED_KEY, JSON.stringify({ wake: live.schedWake, sleep: live.schedSleep })); } catch (e) { /* */ } }
let schedEls = null;
function renderKeepHotSched() {
  if (!host) return;
  let box = host.page.querySelector('.mach-sched');
  if (curTab !== 'machine') { if (box) box.style.display = 'none'; return; }
  if (!box) {
    box = document.createElement('div'); box.className = 'mach-sched'; host.page.appendChild(box);
    const add = (cls, css) => { const d = document.createElement('div'); d.className = cls; if (css) d.style.cssText = css; box.appendChild(d); return d; };
    // on/off switch left of "Keep hot" — same toggle graphic as the advanced editor
    const toggle = add('adv-toggle', 'left:50px;top:1036px');
    const now = add('mach-sched-now', 'left:60px;top:1050px;width:1180px;text-align:right');
    const slider = (x, key) => {
      const sl = document.createElement('div'); sl.className = 'pp-slider h stage-p';   // periwinkle thumb (Ok/Cancel colour)
      sl.style.cssText = `left:${x}px;top:1140px;width:560px;height:118px`;
      const thumb = document.createElement('div'); thumb.className = 'pp-thumb'; sl.appendChild(thumb); box.appendChild(sl);
      attachSchedDrag(sl, key);
      return { sl, thumb };
    };
    const start = slider(60, 'schedWake');
    const end = slider(650, 'schedSleep');
    // tapping a time opens the full-screen time editor (colon entry, +AM/PM in 12h)
    const startLbl = add('mach-sched-lbl', 'left:60px;top:1272px;pointer-events:auto;cursor:pointer');
    const endLbl = add('mach-sched-lbl', 'left:650px;top:1272px;pointer-events:auto;cursor:pointer');
    startLbl.addEventListener('click', () => editSchedTime('Start', 'schedWake'));
    endLbl.addEventListener('click', () => editSchedTime('End', 'schedSleep'));
    schedEls = { box, toggle, now, start, end, startLbl, endLbl };
  }
  box.style.display = 'block';
  schedEls.toggle.classList.toggle('on', !!live.keepHot);
  const vis = live.keepHot ? 'block' : 'none';     // the schedule sliders/times show only when Keep hot is on
  [schedEls.now, schedEls.start.sl, schedEls.end.sl, schedEls.startLbl, schedEls.endLbl].forEach((e) => { e.style.display = vis; });
  if (live.keepHot) refreshSched();
}
function editSchedTime(title, key) {
  import('./numpad.js').then(({ openTimeEditor }) => openTimeEditor({
    title: t(title), minutes: live[key] ?? 0, ampm: is12h(),
    onOk: (v) => { live[key] = Math.max(0, Math.min(1439, v)); saveSched(); refreshSched(); },
  }));
}

// ---- App tab: interactive Bluetooth device list (Tcl Connect: machine on the
// left, scale/other devices on the right). Each row connects/disconnects. ----
let appDevBusy = false;
// Live scale weight / machine metal (group) temperature, streamed and shown after
// "connected" for the connected scale / espresso machine.
let scaleWeight = null, scaleSub = null;
let metalTemp = null, snapSub = null;
const scaleStateEls = [];   // state <div>s of connected scales
const machineStateEls = []; // state <div>s of connected machines
const scaleStateText = () => `<b>${t('connected')}</b> : ${scaleWeight != null ? scaleWeight.toFixed(1) : '—'} g`;
const machineStateText = () => `<b>${t('connected')}</b> : ${metalTemp != null ? metalTemp.toFixed(1) : '—'} °C`;
function ensureScaleSub() {
  if (scaleSub) return;
  scaleSub = api.connectScale((d) => { if (typeof d.weight === 'number') { scaleWeight = d.weight; for (const el of scaleStateEls) el.innerHTML = scaleStateText(); } });
}
function ensureSnapSub() {
  if (snapSub) return;
  snapSub = api.connectSnapshot((d) => { if (typeof d.groupTemperature === 'number') { metalTemp = d.groupTemperature; for (const el of machineStateEls) el.innerHTML = machineStateText(); } });
}
function renderAppDevices() {
  if (!host) return;
  let box = host.page.querySelector('.app-devices');
  if (curTab !== 'app') { if (box) box.style.display = 'none'; return; }
  if (!box) { box = document.createElement('div'); box.className = 'app-devices'; host.page.appendChild(box); }
  box.style.display = 'block';
  box.innerHTML = '';
  scaleStateEls.length = 0; machineStateEls.length = 0;
  ensureScaleSub(); ensureSnapSub();   // stream weight / metal temp for connected devices
  const devs = live._devices || [];
  const column = (x, title, list) => {
    const col = document.createElement('div'); col.className = 'app-dev-col'; col.style.left = x + 'px';
    const h = document.createElement('div'); h.className = 'app-dev-title'; h.textContent = t(title); col.appendChild(h);
    if (!list.length) { const e = document.createElement('div'); e.className = 'app-dev-none'; e.textContent = t('none found'); col.appendChild(e); }
    list.forEach((d) => {
      const row = document.createElement('div'); row.className = 'app-dev-row';
      const info = document.createElement('div');
      const nm = document.createElement('div'); nm.className = 'app-dev-name'; nm.textContent = d.name || d.id;
      const st = document.createElement('div'); st.className = 'app-dev-state';
      const connected = d.state === 'connected';
      if (connected && d.type === 'scale') { st.innerHTML = scaleStateText(); scaleStateEls.push(st); }        // live weight
      else if (connected && d.type === 'machine') { st.innerHTML = machineStateText(); machineStateEls.push(st); }  // live metal temp
      else if (connected) { st.innerHTML = `<b>${t('connected')}</b>`; }
      else st.textContent = t(d.state || '');
      info.appendChild(nm); info.appendChild(st); row.appendChild(info);
      const btn = document.createElement('button'); btn.className = 'app-dev-btn' + (connected ? ' on' : '');
      btn.textContent = connected ? t('Disconnect') : t('Connect');
      btn.addEventListener('click', () => toggleDevice(d, btn));
      row.appendChild(btn);
      col.appendChild(row);
    });
    box.appendChild(col);
  };
  column(60, 'Espresso machine', devs.filter((d) => d.type === 'machine'));
  column(680, 'Scale', devs.filter((d) => d.type !== 'machine'));
}
function toggleDevice(d, btn) {
  if (appDevBusy) return; appDevBusy = true;
  btn.disabled = true; btn.textContent = '…';
  const connecting = d.state !== 'connected';
  // Only one scale and one DE1 may be connected at a time. Before connecting a
  // device, disconnect any already-connected device of the SAME kind (by type) —
  // being connected to two scales or two machines is an error condition.
  const others = connecting ? (live._devices || []).filter((x) => x.type === d.type && x.state === 'connected' && x.id !== d.id) : [];
  const chain = others.reduce((p, o) => p.then(() => api.disconnectDevice(o.id).catch(() => {})), Promise.resolve());
  chain.then(() => (connecting ? api.connectDevice(d.id) : api.disconnectDevice(d.id)))
    .catch((e) => logger.warn('device toggle', e))
    .finally(() => { appDevBusy = false; setTimeout(refreshAppDevices, 700); });
}
async function refreshAppDevices() {
  if (!host) return;
  live._devices = await api.getDevices().catch(() => live._devices || []);
  renderAppDevices();
}

// ---- App tab: screen-brightness slider (Tcl settings_4 scale at 50,660) ----
let brightEls = null;
function renderAppBrightness() {
  if (!host) return;
  let box = host.page.querySelector('.app-bright');
  if (curTab !== 'app') { if (box) box.style.display = 'none'; return; }
  if (!box) {
    box = document.createElement('div'); box.className = 'app-bright'; host.page.appendChild(box);
    const sl = document.createElement('div'); sl.className = 'pp-slider h stage-p';
    sl.style.cssText = 'left:50px;top:660px;width:1170px;height:118px';
    const thumb = document.createElement('div'); thumb.className = 'pp-thumb'; sl.appendChild(thumb); box.appendChild(sl);
    const set = (ev) => {
      const r = sl.getBoundingClientRect();
      const frac = Math.max(0, Math.min(1, (ev.clientX - r.left) / r.width));
      live.brightness = Math.round(frac * 100);
      refreshBright(); host.update(live); api.setBrightness(live.brightness).catch(() => {});
    };
    let drag = false;
    sl.addEventListener('pointerdown', (ev) => { drag = true; sl.setPointerCapture?.(ev.pointerId); set(ev); ev.preventDefault(); });
    sl.addEventListener('pointermove', (ev) => { if (drag) set(ev); });
    const up = (ev) => { drag = false; try { sl.releasePointerCapture?.(ev.pointerId); } catch (e) { /* */ } };
    sl.addEventListener('pointerup', up); sl.addEventListener('pointercancel', up);
    brightEls = { box, sl, thumb };
  }
  box.style.display = 'block';
  refreshBright();
}
function refreshBright() {
  if (!brightEls) return;
  const v = Math.max(0, Math.min(100, live.brightness ?? 100));
  brightEls.thumb.style.left = `calc(${v / 100} * (100% - var(--pp-thumb)))`;
}
function attachSchedDrag(sl, key) {
  const set = (ev) => {
    const r = sl.getBoundingClientRect();
    const frac = Math.max(0, Math.min(1, (ev.clientX - r.left) / r.width));
    live[key] = Math.round(frac * 1439);
    saveSched(); refreshSched();
  };
  let drag = false;
  sl.addEventListener('pointerdown', (ev) => { drag = true; sl.setPointerCapture?.(ev.pointerId); set(ev); ev.preventDefault(); });
  sl.addEventListener('pointermove', (ev) => { if (drag) set(ev); });
  const up = (ev) => { drag = false; try { sl.releasePointerCapture?.(ev.pointerId); } catch (e) { /* */ } };
  sl.addEventListener('pointerup', up); sl.addEventListener('pointercancel', up);
}
function refreshSched() {
  if (!schedEls) return;
  const put = (thumb, min) => { thumb.style.left = `calc(${min / 1439} * (100% - var(--pp-thumb)))`; };
  put(schedEls.start.thumb, live.schedWake); put(schedEls.end.thumb, live.schedSleep);
  schedEls.startLbl.textContent = `${t('Start')} ${fmtHM(live.schedWake)}`;
  schedEls.endLbl.textContent = `${t('End')} ${fmtHM(live.schedSleep)}`;
  const d = new Date();
  schedEls.now.textContent = `${t('Now')} ${fmtHM(d.getHours() * 60 + d.getMinutes())}`;
}
async function loadApp() {
  const [devices, display, plugins, info, rea] = await Promise.all([
    api.getDevices().catch(() => []), api.getDisplayState().catch(() => ({})), api.getPlugins().catch(() => []), api.getAppInfo().catch(() => ({})),
    api.getReaSettings().catch(() => ({})),
  ]);
  live.brightness = typeof display.brightness === 'number' ? display.brightness : 100;
  live._rea = rea || {};   // reaprime /settings (scalePowerMode, lowBatteryBrightnessLimit, chargingMode…) for the Misc page
  live.nPlugins = (plugins || []).length;
  live._devices = devices || [];
  live.appVer = info.fullVersion ? `Decent.app ${info.fullVersion}` : 'version unknown';
  renderAppDevices();
  renderAppBrightness();
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
  // Chooser "Pressure/Flow/Advanced" forces the editor type for a fresh copy;
  // otherwise (e.g. re-editing) we detect it from the steps.
  live.profType = live._forceType || advType(steps);
  live._forceType = null;
  live.advPage = ADV_PAGE[live.profType];
  live._advProfile = structuredClone(wf?.profile || { steps: [] });   // mutable copy the sliders edit
  live.editTemp = steps[0]?.temperature ?? 92;
  // Pressure/Flow profiles get the parametric editor: derive simple params from steps.
  if (live.profType === 'Pressure') live._pp = parsePressure(wf?.profile || { steps: [] });
  else if (live.profType === 'Flow') live._pp = parseFlow(wf?.profile || { steps: [] });
  else { live._advSel = 0; removeAdvancedEditor(host); }   // Advanced: rebuild the editor for this profile
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
  const ms = host.page.querySelector('.mach-sched'); if (ms) ms.style.display = 'none';     // and the keep-hot schedule sliders
  const ad = host.page.querySelector('.app-devices'); if (ad) ad.style.display = 'none';    // and the app device list
  const ab = host.page.querySelector('.app-bright'); if (ab) ab.style.display = 'none';     // and the brightness slider
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
  const mp = host.page.querySelector('.misc-panel');   // Misc renders a full-page overlay, not flow content
  if (mp) mp.remove();
  const cp = host.page.querySelector('.cal-panel');    // Calibrate likewise
  if (cp) cp.remove();
  dialogReturn = null;
}
function dialogClose() {
  const r = dialogReturn; closeSubPanel();
  host.show(r || PAGES[curTab] || 'settings_3'); host.update(live);
  presetChrome(curTab === 'presets');
  renderAdvSliders();   // restore editor sliders if we returned to 2a/2b
  renderKeepHotSched(); // restore the keep-hot schedule sliders on MACHINE
  renderAppDevices();   // restore the Bluetooth device list on APP
  renderAppBrightness();
  if (curTab === 'machine') clearMachineActionUrl();   // drop the /machine/<action> deep-link
  if (curTab === 'app') clearAppActionUrl();           // drop the /app/<action> deep-link (e.g. /app/misc)
}
// Deep-link helpers: each MACHINE sub-action (clean/descale/transport/calibrate/
// firmware) owns a #/settings/machine/<action> URL so it survives a refresh.
function machineActionUrl(name) { if (hooks.onMachineAction) hooks.onMachineAction(name); }
function clearMachineActionUrl() { if (hooks.onMachineAction) hooks.onMachineAction(null); }
// Route-driven trigger (called by app.js applyRoute for #/settings/machine/<action>).
export function settingsMachineAction(name) { const fn = actions[name]; if (fn) fn(); }
// The APP tab's Misc sub-page owns #/settings/app/misc so it survives a refresh.
function appActionUrl(name) { if (hooks.onAppAction) hooks.onAppAction(name); }
function clearAppActionUrl() { if (hooks.onAppAction) hooks.onAppAction(null); }
export function settingsAppAction(name) { const fn = actions[name]; if (fn) fn(); }
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
  const ghRow = spEl('div'); ghRow.style.margin = '8px 0 14px';
  const result = spEl('p', 's2-sp-sub', ''); result.style.margin = '14px 0';
  // Always-visible download+install control. The auto-check just relabels it
  // (newer available vs reinstall latest); tapping downloads GitHub's firmware and
  // uploads it. The actual flash stays confirm-gated (we never silently re-flash).
  const dlBtn = spEl('button', 's2-sp-btn', 'Download latest firmware from GitHub & install');
  async function runFwCheck() {
    try {
      const gh = await githubFwVersion();
      const rel = gh > cur ? `NEWER available (v${gh} > your v${cur})` : gh === cur ? `you are up to date (v${gh})` : `GitHub is older (v${gh} < your v${cur})`;
      result.textContent = `GitHub firmware: v${gh} — ${rel}`;
      dlBtn.dataset.gh = gh;
      dlBtn.textContent = gh > cur ? `Download v${gh} from GitHub & install` : `Reinstall latest firmware (v${gh})`;
    } catch (e) { result.textContent = 'GitHub check failed: ' + e.message; logger.warn('gh fw', e); }
  }
  dlBtn.addEventListener('click', async () => {
    const v = dlBtn.dataset.gh ? `v${dlBtn.dataset.gh}` : 'the latest firmware';
    if (!confirm(`Download ${v} from GitHub and upload it to the DE1? The machine will restart.`)) return;
    const restore = dlBtn.textContent;
    dlBtn.textContent = 'Downloading…';
    try {
      const buf = await fetch(FW_URL).then((r) => r.arrayBuffer());
      dlBtn.textContent = 'Uploading to DE1…';
      const r = await api.uploadFirmware(buf);
      toast(r.ok ? 'Firmware uploaded — machine restarting' : 'Upload failed');
    } catch (e) { logger.warn('fw dl', e); toast('Download/upload failed'); }
    dlBtn.textContent = restore;
  });
  ghRow.appendChild(result); ghRow.appendChild(dlBtn);
  body.appendChild(ghRow);
  // Auto-check GitHub on open (John's todo: auto-compare vs the connected DE1);
  // the button stays visible either way — the actual flash stays confirm-gated.
  result.textContent = 'Checking GitHub for newer firmware…';
  setTimeout(() => runFwCheck(), 80);

  // --- manual file upload ---
  body.appendChild(spEl('p', 's2-sp-sub', 'Or upload a firmware file manually (.dat/.bin). The machine restarts when the update completes.'));
  // Hide the tiny native file input behind a big, finger-friendly "Choose file" button.
  const inp = document.createElement('input'); inp.type = 'file'; inp.accept = '.dat,.bin,.fw,.dfu'; inp.style.display = 'none';
  const chooseBtn = spEl('button', 's2-sp-btn grey', 'Choose file…');
  const fileName = spEl('span', 's2-sp-sub', 'No file chosen'); fileName.style.marginLeft = '28px';
  chooseBtn.addEventListener('click', () => inp.click());
  const fileRow = spEl('div'); fileRow.style.cssText = 'display:flex;align-items:center;margin:14px 0;';
  fileRow.appendChild(chooseBtn); fileRow.appendChild(fileName);
  const btn = spEl('button', 's2-sp-btn', 'Upload firmware'); btn.disabled = true; btn.style.opacity = '.5';
  inp.addEventListener('change', () => { fileName.textContent = inp.files.length ? inp.files[0].name : 'No file chosen'; btn.disabled = !inp.files.length; btn.style.opacity = inp.files.length ? '1' : '.5'; });
  btn.addEventListener('click', () => {
    if (!inp.files.length) return;
    if (!confirm(`Upload ${inp.files[0].name} to the DE1? The machine will restart.`)) return;
    toast('Uploading firmware…');
    api.uploadFirmware(inp.files[0]).then((r) => toast(r.ok ? 'Firmware uploaded — machine restarting' : 'Upload failed')).catch((e) => { logger.warn('fw', e); toast('Upload failed'); });
  });
  body.appendChild(inp); body.appendChild(fileRow); body.appendChild(btn);
}
// Calibrate — faithful port of the Tcl default-skin calibrate / calibrate2 /
// calibrate3 pages, gated behind the same "bad calibration" warning info-page.
// Rendered as a full 2560-space overlay on the settings_message frame, paginated
// 1→2→3→1. Most controls are reaprime-backed: page 1 flow multiplier (/settings),
// steam temp / fan / steam flow (/machine/settings); page 2 heater idle/warmup/
// test + voltage (/machine/settings/advanced); page 3 hot-water/flush (/machine/
// settings) + refill-kit override (/advanced). The temperature/pressure "Measured"
// entries feed the DE1 sensor-calibration path (de1_send_calibration), which
// reaprime does not expose, so they persist locally (as do the page-3 toggles /
// stop-at-weight-offset, which have no gateway field yet).
let calPage = 0;
let calAfterWarn = null;   // dialogOk consumes this to advance the warning gate -> calibrate
// Each calibrate step owns a URL: #/settings/machine/calibrate/{warning,1,2,3,gfc}.
function calStepUrl(step) { if (hooks.onCalStep) hooks.onCalStep(step); }
// GFC uses the single overlay (openOverlay replaces the settings stage), so on
// close we reopen the machine tab — otherwise the URL says /settings/machine while
// the settings overlay is gone. Reopening lands back on a clean machine tab.
function gfcReturn() { clearMachineActionUrl(); openSettings('machine', hooks); }
// Route-driven entry (app.js applyRoute for #/settings/machine/calibrate/<step>).
export function settingsCalStep(step) {
  if (step === 'warning') { calibrateWarn(); return; }
  if (step === 'gfc') { calStepUrl('gfc'); openGFC(gfcReturn); return; }
  const n = parseInt(step, 10);
  if (n >= 1 && n <= 3) { calPage = n - 1; calibrateOpen(); }
}
function calibrateWarn() {
  calStepUrl('warning');
  calAfterWarn = () => { calPage = 0; calibrateOpen(); };
  subPanel('', (body) => {
    body.style.cssText += ';display:flex;align-items:center;justify-content:center;text-align:center;';
    const p = spEl('div'); p.style.cssText = 'font-size:52px;font-weight:700;color:#2d3046;line-height:1.35;max-width:1620px;';
    p.textContent = t('Bad calibration settings might make your espresso machine unuseable.  Only proceed if you have been told to or have read the relevant manual sections and know what you are doing.');
    body.appendChild(p);
  });
}
function calibrateOpen() {
  // Open the calibrate frame synchronously (no await) so the warning's Ok has an
  // immediate effect — otherwise the ~1s settings fetch leaves the warning up, and
  // a second Ok tap falls through to dialogClose and bounces back to the machine
  // tab. Seed with the last-known/placeholder values, then refresh when data lands.
  if (!live._cal) live._cal = { ms: {}, adv: {}, rea: {}, goalTemp: 92, goalPress: 9 };
  calStepUrl(String(calPage + 1));   // #/settings/machine/calibrate/<page>
  subPanel('Calibrate', calBuild);
  Promise.all([
    api.getMachineSettings().catch(() => ({})), api.getMachineAdvancedSettings().catch(() => ({})),
    api.getReaSettings().catch(() => ({})), api.getWorkflow().catch(() => ({})),
  ]).then(([ms, adv, rea, wf]) => {
    const steps = (wf && wf.profile && wf.profile.steps) || [];
    const goalTemp = steps.length ? (steps[0].temperature ?? 92) : 92;
    const goalPress = steps.reduce((m, s) => Math.max(m, s.pressure ?? 0), 0) || 9;
    live._cal = { ms: ms || {}, adv: adv || {}, rea: rea || {}, goalTemp, goalPress };
    if (host && host.page.querySelector('.cal-panel')) renderCalPage();   // repaint with real values
  }).catch((e) => logger.warn('cal load', e));
}
function calBuild(body) {
  body.style.display = 'none';
  let cp = host.page.querySelector('.cal-panel'); if (cp) cp.remove();
  cp = document.createElement('div'); cp.className = 'cal-panel'; host.page.appendChild(cp);
  renderCalPage();
}
function calNumpad(title, value, decimals, min, max, onOk) {
  import('./numpad.js').then(({ openNumpad }) => openNumpad({ title: t(title), value, min, max, decimals, onOk }));
}
function renderCalPage() {
  const box = host.page.querySelector('.cal-panel'); if (!box) return;
  box.innerHTML = '';
  const d = live._cal || { ms: {}, adv: {}, rea: {}, goalTemp: 92, goalPress: 9 };
  const g = (k, dv) => { const v = localStorage.getItem(k); return v == null ? dv : v; };
  const saveMs = (k, v) => { (d.ms)[k] = v; api.setMachineSettings({ [k]: v }).catch((e) => logger.warn('cal ms', e)); };
  const saveAdv = (k, v) => { (d.adv)[k] = v; api.setMachineAdvancedSettings({ [k]: v }).catch((e) => logger.warn('cal adv', e)); };
  const saveRea = (k, v) => { (d.rea)[k] = v; api.setReaSettings({ [k]: v }).catch((e) => logger.warn('cal rea', e)); };
  // ---- overlay control helpers (2560-space) ----
  const txt = (x, y, s, o = {}) => { const e = spEl('div', 'misc-txt'); e.textContent = s;
    e.style.cssText = `left:${x}px;top:${y}px;font-size:${o.size || 36}px;font-weight:${o.weight || 400};color:${o.color || C.title};`;
    if (o.width) { e.style.width = o.width + 'px'; e.style.whiteSpace = 'normal'; }
    if (o.anchor === 'ne') e.style.transform = 'translateX(-100%)';
    box.appendChild(e); return e; };
  const link = (x, y, s, onClick) => { const e = txt(x, y, s, { size: 36, weight: 700, color: C.val }); e.style.pointerEvents = 'auto'; e.style.cursor = 'pointer'; e.addEventListener('click', onClick); return e; };
  const entry = (x, y, v, onTap) => { const e = spEl('div', 'cal-entry'); e.style.cssText = `left:${x}px;top:${y}px;pointer-events:auto;cursor:pointer`; e.textContent = v; e.addEventListener('click', onTap); box.appendChild(e); return e; };
  const toggle = (x, y, on, onChange) => { const tg = spEl('div', 'adv-toggle' + (on ? ' on' : '')); tg.style.cssText = `left:${x}px;top:${y}px;pointer-events:auto;cursor:pointer`;
    tg.addEventListener('click', () => { const nw = !tg.classList.contains('on'); tg.classList.toggle('on', nw); onChange(nw); }); box.appendChild(tg); return tg; };
  const toggleRow = (tx, ty, lx, ly, label, on, onChange) => { const tg = toggle(tx, ty, on, onChange); const l = txt(lx, ly, t(label), { size: 40, color: C.val }); l.style.pointerEvents = 'auto'; l.style.cursor = 'pointer'; l.addEventListener('click', () => tg.click()); };
  const seg = (x, y, w, h, labels, sel, onSel) => { const c = spEl('div', 'misc-seg'); c.style.cssText = `left:${x}px;top:${y}px;width:${w}px;height:${h}px;pointer-events:auto`;
    labels.forEach((L, i) => { const s = spEl('div', 'misc-seg-b' + (i === sel ? ' on' : '')); s.textContent = t(L); s.addEventListener('click', () => { [...c.children].forEach((ch, j) => ch.classList.toggle('on', j === i)); onSel(i); }); c.appendChild(s); }); box.appendChild(c); };
  const slider = (x, y, w, min, max, val, onChange, h = 80) => { const sl = spEl('div', 'pp-slider h stage-tan'); sl.style.cssText = `left:${x}px;top:${y}px;width:${w}px;height:${h}px`;
    const th = spEl('div', 'pp-thumb'); sl.appendChild(th);
    const put = (v) => { const f = Math.max(0, Math.min(1, (v - min) / (max - min))); th.style.left = `calc(${f} * (100% - var(--pp-thumb)))`; }; put(val);
    const setv = (ev) => { const r = sl.getBoundingClientRect(); const f = Math.max(0, Math.min(1, (ev.clientX - r.left) / r.width)); const v = min + f * (max - min); put(v); onChange(v); };
    let drag = false; sl.addEventListener('pointerdown', (ev) => { drag = true; sl.setPointerCapture?.(ev.pointerId); setv(ev); ev.preventDefault(); });
    sl.addEventListener('pointermove', (ev) => { if (drag) setv(ev); }); const up = (ev) => { drag = false; try { sl.releasePointerCapture?.(ev.pointerId); } catch (e) { /* */ } };
    sl.addEventListener('pointerup', up); sl.addEventListener('pointercancel', up); box.appendChild(sl); };
  const btn = (x, y, w, label, onClick) => { const b = spEl('div', 'cal-btn'); b.style.cssText = `left:${x}px;top:${y}px;width:${w}px;pointer-events:auto`; b.textContent = label; b.addEventListener('click', onClick); box.appendChild(b); };

  if (calPage === 0) {
    // ===== Page 1: sensor table (Saved | Factory | Sensor | Goal | Measured) =====
    txt(500, 350, t('Saved'), { size: 34, weight: 700, color: '#c0c4e1', anchor: 'ne' });
    txt(760, 350, t('Factory'), { size: 34, weight: 700, color: '#c0c4e1', anchor: 'ne' });
    txt(850, 350, t('Sensor'), { size: 34, weight: 700, color: '#c0c4e1' });
    txt(1750, 350, t('Goal'), { size: 34, weight: 700, color: '#c0c4e1', anchor: 'ne' });
    txt(1880, 350, t('Measured'), { size: 34, weight: 700, color: '#c0c4e1' });
    const R = (n) => 350 + n * 115;
    // Temperature (sensor calibration -> local; Goal = profile temperature)
    txt(850, R(1), t('Temperature'), { size: 38, weight: 700 });
    txt(1750, R(1), `${d.goalTemp.toFixed(1)}°C`, { size: 36, anchor: 'ne' });
    let tm = parseFloat(g('cal_temp_measured', d.goalTemp.toFixed(1)));
    const te = entry(1880, R(1) - 34, tm.toFixed(1), () => calNumpad('Temperature', tm, 1, 1, 120, (v) => { tm = v; localStorage.setItem('cal_temp_measured', v); te.textContent = v.toFixed(1); }));
    // Pressure (sensor calibration -> local; Goal = profile peak pressure)
    txt(850, R(2), t('Pressure'), { size: 38, weight: 700 });
    txt(1750, R(2), `${d.goalPress.toFixed(1)} bar`, { size: 36, anchor: 'ne' });
    let pm = parseFloat(g('cal_press_measured', d.goalPress.toFixed(1)));
    const pe = entry(1880, R(2) - 34, pm.toFixed(1), () => calNumpad('Pressure', pm, 1, 0, 15, (v) => { pm = v; localStorage.setItem('cal_press_measured', v); pe.textContent = v.toFixed(1); }));
    // Flow multiplier (/settings weightFlowMultiplier) — Goal shows the multiplier
    txt(850, R(3), t('Flow'), { size: 38, weight: 700 });
    const fm0 = d.rea.weightFlowMultiplier ?? 1;
    const fg = txt(1750, R(3), `x ${fm0.toFixed(3)}`, { size: 36, anchor: 'ne' });
    slider(1880, R(3) - 22, 400, 0.13, 2, fm0, (v) => { v = Math.round(v / 0.01) * 0.01; fg.textContent = `x ${v.toFixed(3)}`; saveRea('weightFlowMultiplier', v); });
    // Steam temperature (/machine/settings steamTemp)
    txt(850, R(4), t('Steam temperature'), { size: 38, weight: 700 });
    txt(500, R(4), '—', { size: 34, anchor: 'ne' }); txt(760, R(4), '—', { size: 34, anchor: 'ne' });
    const st0 = d.ms.steamTemp ?? parseFloat(g('cal_steam_temp', '160'));
    const sg = txt(1750, R(4), `${Math.round(st0)}°C`, { size: 36, anchor: 'ne' });
    slider(1880, R(4) - 22, 400, 134, 170, st0, (v) => { v = Math.round(v); sg.textContent = `${v}°C`; localStorage.setItem('cal_steam_temp', v); saveMs('steamTemp', v); });
    // Fan turns on at (/machine/settings fan)
    txt(850, R(5), t('Fan turns on at:'), { size: 38, weight: 700 });
    const fan0 = d.ms.fan ?? 60;
    const fang = txt(1750, R(5), `${Math.round(fan0)}°C`, { size: 36, anchor: 'ne' });
    slider(1880, R(5) - 22, 400, 0, 100, fan0, (v) => { v = Math.round(v); fang.textContent = `${v}°C`; saveMs('fan', v); });
    // Steam flow rate (/machine/settings steamFlow)
    txt(850, R(6), t('Steam flow rate'), { size: 38, weight: 700 });
    txt(500, R(6), '—', { size: 34, anchor: 'ne' }); txt(760, R(6), '—', { size: 34, anchor: 'ne' });
    const sf0 = d.ms.steamFlow ?? 1.6;
    const sfg = txt(1750, R(6), `${sf0.toFixed(1)} mL/s`, { size: 36, anchor: 'ne' });
    slider(1880, R(6) - 22, 400, 0.4, 2.5, sf0, (v) => { v = Math.round(v / 0.1) * 0.1; sfg.textContent = `${v.toFixed(1)} mL/s`; saveMs('steamFlow', v); });
    // GFC button hidden for now (still reachable via #/settings/machine/calibrate/gfc):
    // btn(1470, 1450, 540, t('Graphical Flow Calibrator'), () => { calStepUrl('gfc'); closeSubPanel(); openGFC(gfcReturn); });
  } else if (calPage === 1) {
    // ===== Page 2: voltage + heater warmup/test tuning (/machine/settings/advanced) =====
    txt(350, 450, t('Voltage'), { size: 38, weight: 700 });
    const hv = d.adv.heaterVoltage;
    const hvLabel = (hv == 120 || hv == 1120) ? '120V' : (hv == 230 || hv == 1230) ? '230V' : (hv > 50 && hv < 300) ? `${hv}V` : t('unknown');
    txt(700, 450, hvLabel, { size: 38, weight: 700 });
    if (hv != 120 && hv != 1120) link(1000, 450, `[ ${t('Set to 120V')} ]`, () => { saveAdv('heaterVoltage', 120); renderCalPage(); });
    if (hv != 230 && hv != 1230) link(1600, 450, `[ ${t('Set to 230V')} ]`, () => { saveAdv('heaterVoltage', 230); renderCalPage(); });
    // Heater idle temperature
    txt(350, 610, t('Heater idle temperature'), { size: 34, weight: 700 });
    const hit = d.adv.heaterIdleTemp ?? 99; const hitv = txt(970, 678, `${Math.round(hit)}°C`, { size: 34 });
    slider(350, 652, 600, 0, 99, hit, (v) => { v = Math.round(v); hitv.textContent = `${v}°C`; saveAdv('heaterIdleTemp', v); });
    // Heater warmup flow rate
    txt(350, 810, t('Heater warmup flow rate'), { size: 34, weight: 700 });
    const p1 = d.adv.heaterPh1Flow ?? 2; const p1v = txt(970, 878, `${p1.toFixed(1)} mL/s`, { size: 34 });
    slider(350, 852, 600, 0.5, 6, p1, (v) => { v = Math.round(v / 0.1) * 0.1; p1v.textContent = `${v.toFixed(1)} mL/s`; saveAdv('heaterPh1Flow', v); });
    // Heater test time-out
    txt(1350, 610, t('Heater test time-out'), { size: 34, weight: 700 });
    const to = d.adv.heaterPh2Timeout ?? 1; const tov = txt(1970, 678, `${to.toFixed(1)} ${t('seconds')}`, { size: 34 });
    slider(1350, 652, 600, 1, 30, to, (v) => { v = Math.round(v / 0.1) * 0.1; tov.textContent = `${v.toFixed(1)} ${t('seconds')}`; saveAdv('heaterPh2Timeout', v); });
    // Heater test flow rate
    txt(1350, 810, t('Heater test flow rate'), { size: 34, weight: 700 });
    const p2 = d.adv.heaterPh2Flow ?? 4; const p2v = txt(1970, 878, `${p2.toFixed(1)} mL/s`, { size: 34 });
    slider(1350, 852, 600, 0.5, 8, p2, (v) => { v = Math.round(v / 0.1) * 0.1; p2v.textContent = `${v.toFixed(1)} mL/s`; saveAdv('heaterPh2Flow', v); });
    // Stop at weight offset (no gateway field -> local)
    txt(1350, 1000, t('Stop at weight offset'), { size: 34, weight: 700 });
    let swo = parseFloat(g('cal_stop_weight_offset', '0.15')); const swov = txt(1970, 1068, `${swo.toFixed(2)} ${t('seconds')}`, { size: 34 });
    slider(1350, 1042, 600, 0, 2, swo, (v) => { v = Math.round(v / 0.01) * 0.01; swo = v; swov.textContent = `${v.toFixed(2)} ${t('seconds')}`; localStorage.setItem('cal_stop_weight_offset', v); });
    // Defaults for cafe
    link(350, 1075, `[ ${t('Defaults for cafe')} ]`, () => { saveAdv('heaterIdleTemp', 99); saveAdv('heaterPh2Timeout', 1); saveAdv('heaterPh1Flow', 2); saveAdv('heaterPh2Flow', 4); renderCalPage(); });
  } else {
    // ===== Page 3: hot-water/flush + steam options + refill-kit =====
    txt(350, 510, t('Hot water flow rate'), { size: 34, weight: 700 });
    const hwf = d.ms.hotWaterFlow ?? 10; const hwfv = txt(970, 578, `${hwf.toFixed(1)} mL/s`, { size: 34 });
    slider(350, 552, 600, 1, 10, hwf, (v) => { v = Math.round(v / 0.1) * 0.1; hwfv.textContent = `${v.toFixed(1)} mL/s`; saveMs('hotWaterFlow', v); });
    txt(350, 710, t('Flush flow rate'), { size: 34, weight: 700 });
    const ff = d.ms.flushFlow ?? 6; const ffv = txt(970, 778, `${ff.toFixed(1)} mL/s`, { size: 34 });
    slider(350, 752, 600, 1, 10, ff, (v) => { v = Math.round(v / 0.1) * 0.1; ffv.textContent = `${v.toFixed(1)} mL/s`; saveMs('flushFlow', v); });
    txt(350, 910, t('Flush timeout'), { size: 34, weight: 700 });
    const fto = d.ms.flushTimeout ?? 5; const ftov = txt(970, 978, `${Math.round(fto)} ${t('seconds')}`, { size: 34 });
    slider(350, 952, 600, 3, 120, fto, (v) => { v = Math.round(v); ftov.textContent = `${v} ${t('seconds')}`; saveMs('flushTimeout', v); });
    toggleRow(1350, 566, 1500, 564, 'Two tap steam stop', g('cal_two_tap', '0') === '1', (v) => localStorage.setItem('cal_two_tap', v ? '1' : '0'));
    toggleRow(1350, 666, 1500, 664, 'Slow start', g('cal_slow_start', '0') === '1', (v) => localStorage.setItem('cal_slow_start', v ? '1' : '0'));
    toggleRow(1350, 766, 1500, 764, 'Eco steam', g('cal_eco_steam', '0') === '1', (v) => localStorage.setItem('cal_eco_steam', v ? '1' : '0'));
    // Refill kit override (/machine/settings/advanced refillKitSetting: auto=2, off=0, on=1)
    txt(1350, 960, t('Refill kit: unable to detect'), { size: 30, weight: 700 });
    const rk = d.adv.refillKitSetting;
    const rkSel = rk === 0 ? 1 : rk === 1 ? 2 : 0;
    seg(1350, 1020, 900, 80, ['auto-detect', 'force off', 'force on'], rkSel, (i) => saveAdv('refillKitSetting', i === 0 ? 2 : i === 1 ? 0 : 1));
  }
  // page-nav button (cycles 1 -> 2 -> 3 -> 1)
  btn(2060, 1450, 450, `${t('Page')} ${calPage + 1} ${t('of')} 3 >`, () => { calPage = (calPage + 1) % 3; calStepUrl(String(calPage + 1)); renderCalPage(); });
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
}
// Misc — faithful port of the Tcl default-skin "measurements" page: a two-column
// panel of toggles / segmented selectors / tan sliders. Rendered as a full
// 2560-space overlay on the settings_message frame (title + baked Ok), so every
// control sits at its native Tcl coordinate. Settings are cosmetic app-level
// preferences (no reaprime endpoint, exactly as the Tcl stores them in ::settings),
// persisted to localStorage; the units toggle shares the existing 'units' key.
function miscPanel(body) {
  body.style.display = 'none';                                   // the flow-content container is unused for Misc
  let mp = host.page.querySelector('.misc-panel'); if (mp) mp.remove();
  mp = document.createElement('div'); mp.className = 'misc-panel'; host.page.appendChild(mp);

  const g = (k, d) => { const v = localStorage.getItem(k); return v == null ? d : v; };
  const gi = (k, d) => { const v = parseFloat(localStorage.getItem(k)); return Number.isFinite(v) ? v : d; };
  const set = (k, v) => localStorage.setItem(k, v);

  // text: anchor nw (default) / ne (right-aligned) / center — mirrors add_de1_text.
  const txt = (x, y, s, o = {}) => {
    const d = document.createElement('div'); d.className = 'misc-txt'; d.textContent = s;
    d.style.cssText = `left:${x}px;top:${y}px;font-size:${o.size || 40}px;font-weight:${o.weight || 400};color:${o.color || C.title};`;
    if (o.width) { d.style.width = o.width + 'px'; d.style.whiteSpace = 'normal'; }
    if (o.anchor === 'ne') d.style.transform = 'translateX(-100%)';
    if (o.anchor === 'center') d.style.transform = 'translateX(-50%)';
    mp.appendChild(d); return d;
  };
  // on/off toggle (same graphic as the advanced editor); clicking the paired blue
  // label toggles it too, matching the Tcl button hit-zone over toggle+text.
  const toggle = (x, y, on, onChange) => {
    const t = document.createElement('div'); t.className = 'adv-toggle' + (on ? ' on' : '');
    t.style.cssText = `left:${x}px;top:${y}px;pointer-events:auto;cursor:pointer`;
    t.addEventListener('click', () => { const now = !t.classList.contains('on'); t.classList.toggle('on', now); onChange(now); });
    mp.appendChild(t); return t;
  };
  const toggleRow = (togX, togY, labX, labY, label, on, onChange, o = {}) => {
    const t = toggle(togX, togY, on, onChange);
    const l = txt(labX, labY, t2(label), { size: 40, color: C.val, anchor: o.anchor, width: o.width });
    l.style.pointerEvents = 'auto'; l.style.cursor = 'pointer'; l.addEventListener('click', () => t.click());
    return t;
  };
  // segmented selector (dui dselector): equal blue-fill segments, selected index sel.
  const seg = (x, y, w, h, labels, sel, onSel, o = {}) => {
    const c = document.createElement('div'); c.className = 'misc-seg';
    c.style.cssText = `left:${x}px;top:${y}px;width:${w}px;height:${h}px;pointer-events:auto`;
    if (o.anchor === 'ne') c.style.transform = 'translateX(-100%)';
    labels.forEach((L, i) => { const s = document.createElement('div'); s.className = 'misc-seg-b' + (i === sel ? ' on' : ''); s.textContent = t2(L);
      s.addEventListener('click', () => { [...c.children].forEach((ch, j) => ch.classList.toggle('on', j === i)); onSel(i); }); c.appendChild(s); });
    mp.appendChild(c); return c;
  };
  // tan slider (Tk scale, #e4d1c1 thumb on the grey trough) over a numeric range.
  const slider = (x, y, w, min, max, val, onChange, h = 96) => {
    const sl = document.createElement('div'); sl.className = 'pp-slider h stage-tan';
    sl.style.cssText = `left:${x}px;top:${y}px;width:${w}px;height:${h}px`;
    const thumb = document.createElement('div'); thumb.className = 'pp-thumb'; sl.appendChild(thumb);
    const put = (v) => { const f = Math.max(0, Math.min(1, (v - min) / (max - min))); thumb.style.left = `calc(${f} * (100% - var(--pp-thumb)))`; };
    put(val);
    const setv = (ev) => { const r = sl.getBoundingClientRect(); const f = Math.max(0, Math.min(1, (ev.clientX - r.left) / r.width)); const v = min + f * (max - min); put(v); onChange(v); };
    let drag = false;
    sl.addEventListener('pointerdown', (ev) => { drag = true; sl.setPointerCapture?.(ev.pointerId); setv(ev); ev.preventDefault(); });
    sl.addEventListener('pointermove', (ev) => { if (drag) setv(ev); });
    const up = (ev) => { drag = false; try { sl.releasePointerCapture?.(ev.pointerId); } catch (e) { /* */ } };
    sl.addEventListener('pointerup', up); sl.addEventListener('pointercancel', up);
    mp.appendChild(sl); return { put };
  };
  const t2 = (s) => t(s);   // alias (keeps the seg / toggleRow helpers terse)
  // reaprime /settings writes (POST merges the partial, same as the Streamline
  // skin's updateReaSetting → setReaSettings flush). Cache locally + fire-and-forget.
  const rea = live._rea || (live._rea = {});
  const setRea = (k, v) => { rea[k] = v; api.setReaSettings({ [k]: v }).catch((e) => logger.warn('setRea ' + k, e)); };

  // ===== LEFT COLUMN =====
  // Screen saver: label + "clock" toggle (drives saver.js), live REA brightness,
  // and the change-image interval (feeds saver.js insight_saver_interval_sec).
  txt(340, 500, t('Screen saver'), { size: 42, weight: 700 });
  txt(1040, 498, t('clock'), { size: 40, color: C.val, anchor: 'ne' });
  toggle(1060, 502, g('insight_saver_clock', '0') === '1', (v) => set('insight_saver_clock', v ? '1' : '0'));
  let bval; const brightNow = () => Math.round(live.brightness ?? 100);
  bval = txt(340, 664, `${t('Brightness')} ${brightNow()}%`, { size: 38 });
  slider(340, 560, 800, 0, 100, brightNow(), (v) => { const n = Math.round(v); live.brightness = n; bval.textContent = `${t('Brightness')} ${n}%`; api.setBrightness(n).catch(() => {}); });
  let ival; const ivMin = () => Math.max(0, Math.round(gi('insight_saver_interval_sec', 600) / 60));
  ival = txt(340, 844, `${t('Change image every')}: ${ivMin()} ${t('minutes')}`, { size: 38 });
  slider(340, 740, 800, 0, 120, ivMin(), (v) => { const n = Math.round(v); set('insight_saver_interval_sec', n * 60); ival.textContent = `${t('Change image every')}: ${n} ${t('minutes')}`; });

  // ===== RIGHT COLUMN =====
  // Celsius / Fahrenheit — client-side unit preference (no reaprime field; the
  // Streamline skin leaves this inert too). Shares the existing 'units' key.
  seg(2280, 480, 600, 80, ['Celsius', 'Fahrenheit'], g('units', 'c') === 'f' ? 1 : 0, (i) => set('units', i === 1 ? 'f' : 'c'), { anchor: 'ne' });
  // AM/PM — overrides the OS locale for the keep-hot schedule clock (is12h()).
  const ampmOn = () => { const o = localStorage.getItem('insight_ampm'); return o === '1' || (o == null && is12h()); };
  toggleRow(1280, 506, 1420, 504, 'AM/PM', ampmOn(), (v) => set('insight_ampm', v ? '1' : '0'));
  // 1.234,56 — client-side decimal-comma preference (no reaprime field yet).
  toggleRow(1280, 606, 1420, 604, '1.234,56', g('insight_comma', '0') === '1', (v) => set('insight_comma', v ? '1' : '0'));
  // Keep scale on → reaprime scalePowerMode: 'disabled' keeps the scale powered,
  // 'displayOff' lets it sleep with the machine.
  toggleRow(1280, 706, 1420, 704, 'Keep scale on', (rea.scalePowerMode || 'disabled') === 'disabled', (v) => setRea('scalePowerMode', v ? 'disabled' : 'displayOff'));
  // Dim screen when battery low → reaprime lowBatteryBrightnessLimit (boolean).
  toggleRow(1740, 606, 1880, 584, 'Dim screen when battery low', !!rea.lowBatteryBrightnessLimit, (v) => setRea('lowBatteryBrightnessLimit', v), { width: 440 });
  // Smart charging → reaprime chargingMode + nightModeEnabled.
  //   off = no battery management · on = balanced (80%) · night = balanced + night mode.
  txt(1300, 1020, t('Smart charging'), { size: 42, weight: 700 });
  const scSel = rea.nightModeEnabled ? 2 : ((rea.chargingMode || 'disabled') === 'disabled' ? 0 : 1);
  seg(1300, 1080, 1000, 80, ['off', 'on', 'night'], scSel, (i) => {
    setRea('chargingMode', i === 0 ? 'disabled' : 'balanced');
    setRea('nightModeEnabled', i === 2);
  });
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
    live._newType = kind; live._forceType = kind;
  } catch (e) { logger.warn('newPreset', e); }
  // Pressure/Flow/Advanced all open their faithful editor via goto('advanced'),
  // which dispatches by profile type.
  goto('advanced');
}

const actions = {
  navPresets: () => goto('presets'), navAdvanced: () => openAdvancedForSelected(), navMachine: () => goto('machine'), navApp: () => goto('app'),
  dialogOk: () => { if (calAfterWarn) { const f = calAfterWarn; calAfterWarn = null; f(); return; } dialogClose(); },
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
  extPicker: () => subPanel('Extensions', extPanel), misc: () => { appActionUrl('misc'); subPanel('Misc', miscPanel); },
  firmware: () => { machineActionUrl('firmware'); subPanel('Firmware', firmwarePanel); },
  appUpdate: () => {
    // Show progress in the button itself (no toast): "Check for updates" -> "Updating…" -> result.
    live.appUpdateLabel = t('Updating…'); host.update(live);
    api.updateSkins()
      .then((r) => { live.appUpdateLabel = r.ok ? t('Up to date') : t('Update failed'); })
      .catch(() => { live.appUpdateLabel = t('Update failed'); })
      .finally(() => { host.update(live); setTimeout(() => { live.appUpdateLabel = null; host.update(live); }, 3000); });
  },
  cancel: () => { clearTimeout(advSaveT); cleanup(); closeOverlay(); opened = false; if (hooks.onClose) hooks.onClose(); },
  // Ok: flush the in-progress profile edit to the workflow, then close and tell
  // the espresso page to reload it, so what you edited is what you see.
  ok: async () => {
    clearTimeout(advSaveT);
    if (curTab === 'advanced' && live._advProfile) { try { await api.updateWorkflow({ profile: live._advProfile }); } catch (e) { logger.warn('ok save', e); } }
    cleanup(); closeOverlay(); opened = false;
    if (hooks.onClose) hooks.onClose();
    window.dispatchEvent(new Event('insight-workflow-changed'));
  },
  // MACHINE
  editCool: () => num('Cool down after (min)', 'coolMin', 5, 240, 5, (v) => api.setPresence({ ...(live._presence || {}), sleepTimeoutMinutes: v }).catch((e) => logger.warn('presence', e))),
  toggleKeepHot: () => { live.keepHot = !live.keepHot; host.update(live); renderKeepHotSched(); api.setPresence({ ...(live._presence || {}), userPresenceEnabled: !live.keepHot }).catch((e) => logger.warn('presence', e)); },
  readManual: () => window.open(manualUrl(), '_blank'),
  clean: () => { machineActionUrl('clean'); if (confirm('Run cleaning cycle?')) openMaintenance('clean', clearMachineActionUrl); else clearMachineActionUrl(); },
  descale: () => { machineActionUrl('descale'); openMaintenance('descale', clearMachineActionUrl); },
  calibrate: () => calibrateWarn(),   // warns first; calStepUrl writes /calibrate/warning
  transport: () => { machineActionUrl('transport'); openMaintenance('transport', clearMachineActionUrl); },
  // APP
  editBrightness: () => num('Screen brightness (%)', 'brightness', 5, 100, 5, (v) => api.setBrightness(v)),
  searchDevices: () => { toast('Scanning for Bluetooth devices…'); api.scanDevices(false).catch((e) => logger.warn('scan', e)).finally(() => setTimeout(refreshAppDevices, 1000)); },
  docs: () => window.open(quickstartUrl(), '_blank'),
  // Tcl "Exit app" sleeps the machine + exits the native app. A web/Catalyst build
  // can't quit itself, so we sleep the machine (the meaningful part) and close settings.
  exitApp: () => { api.setMachineState('sleeping').catch(() => {}); actions.cancel(); },
  // PRESETS / ADVANCED
  openEditor: () => openProfileEditor(() => goto('advanced')),
  advTempUp: () => advTemp(+1), advTempDown: () => advTemp(-1),
  ppToggleTemps: () => { ppToggleTempSteps(live); saveAdv(); },
  // Advanced editor Steps/Limits sub-tabs (switch page without reloading the profile)
  advTabSteps: () => { live.advPage = 'settings_2c'; host.show('settings_2c'); host.update(live); renderAdvancedEditor(host, live, saveAdv); },
  advTabLimits: () => { live.advPage = 'settings_2c2'; host.show('settings_2c2'); host.update(live); renderAdvancedEditor(host, live, saveAdv); },
};
// Temperature +/- on the 2a/2b/2c thermometer sets every step's temperature.
// On the pressure editor it drives the parametric temp param instead.
function advTemp(d) {
  if (curTab === 'advanced' && (live.advPage === 'settings_2a' || live.advPage === 'settings_2b')) { ppTempAdjust(live, d); saveAdv(); return; }
  if (!live._advProfile) return;
  live.editTemp = Math.min(105, Math.max(80, Math.round((live.editTemp ?? 92) + d)));
  (live._advProfile.steps || []).forEach((s) => { s.temperature = live.editTemp; });
  host.update(live); saveAdv();
}
function cleanup() { closeSubPanel(); removeProfileEditor(host); removeAdvancedEditor(host); schedEls = null; if (host) { brightEls = null; if (scaleSub) { try { scaleSub.close(); } catch (e) { /* */ } scaleSub = null; } if (snapSub) { try { snapSub.close(); } catch (e) { /* */ } snapSub = null; } scaleStateEls.length = 0; machineStateEls.length = 0; ['.s2-preset-scroll', '.adv-sliders', '.s2-name-input', '.mach-sched', '.app-devices', '.app-bright', '.misc-panel', '.cal-panel'].forEach((s) => { const el = host.page.querySelector(s); if (el) el.remove(); }); } }
