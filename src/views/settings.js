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
import { openOverlay, closeOverlay } from '../modules/overlay.js';
import { openGFC } from './gfc.js';
import { openProfileEditor } from './profile_editor.js';
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
  spacing: o.spacing, width: o.width, wrap: o.wrap, notPages: o.notPages });
const B = (pages, rect, action, notPages) => ({ kind: 'button', pages, rect, action, notPages });

// The 4 settings tabs share this top bar (icons are baked; labels overlaid).
const PAGES = { presets: 'settings_1', advanced: 'settings_2c', machine: 'settings_3', app: 'settings_4' };
const TAB_LABELS = [
  ['presets', 'PRESETS', 430], ['advanced', 'ADVANCED', 1060], ['machine', 'MACHINE', 1660], ['app', 'APP', 2300],
];
// A modal dialog (settings_message) hides the tab bar + main Cancel/Ok.
const MODAL = ['settings_message'];
const tabBar = [
  B(['*'], [0, 0, 640, 190], 'navPresets', MODAL),
  B(['*'], [640, 0, 1280, 190], 'navAdvanced', MODAL),
  B(['*'], [1280, 0, 1920, 190], 'navMachine', MODAL),
  B(['*'], [1920, 0, 2560, 190], 'navApp', MODAL),
  ...TAB_LABELS.map(([tab, text, x]) => V(['*'], x, 98, { anchor: 'center', size: 50, weight: 'bold', notPages: MODAL,
    bind: () => t(text), fillBind: (l) => (l.tab === tab ? C.dark : C.tabOff) })),
  // baked Cancel / Ok frames at the bottom
  B(['*'], [1500, 1450, 2040, 1585], 'cancel', MODAL),
  B(['*'], [2050, 1450, 2560, 1585], 'ok', MODAL),
  V(['*'], 1770, 1490, { anchor: 'center', size: 48, weight: 'bold', fill: '#3d4468', notPages: MODAL, bind: () => t('Cancel') }),
  V(['*'], 2305, 1490, { anchor: 'center', size: 48, weight: 'bold', fill: '#3d4468', notPages: MODAL, bind: () => t('Ok') }),
  // ---- settings_message dialog chrome (title + baked Ok) ----
  V(MODAL, 1280, 190, { anchor: 'center', size: 72, weight: 'bold', fill: C.dark, bind: (l) => l.dialogTitle || '' }),
  B(MODAL, [1030, 1235, 1560, 1350], 'dialogOk'),
  V(MODAL, 1293, 1290, { anchor: 'center', size: 52, weight: 'bold', fill: '#fafbff', bind: () => t('Ok') }),
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
const P1 = ['settings_1'];
const presetEls = [
  V(P1, 55, 225, { size: 50, weight: 'bold', fill: C.title, bind: () => t('Load a preset') }),
  // profile list is rendered as an HTML scroller injected over the left card
  V(P1, 1360, 130, { size: 50, weight: 'bold', fill: C.title, bind: () => t('Preview') }),
  V(P1, 1360, 620, { size: 50, weight: 'bold', fill: C.title, bind: () => t('Description') }),
  V(P1, 1360, 700, { size: 36, fill: C.muted, width: 1080, wrap: true, bind: (l) => l.presetDesc || '' }),
  V(P1, 1360, 1080, { size: 46, fill: C.title, weight: 'bold', bind: () => t('Pick a new name to save') }),
  V(P1, 1370, 1160, { size: 40, fill: C.val, bind: (l) => l.presetName || '' }),
];

// ---- ADVANCED — the editor page tracks the profile type -------------------
// Insight uses settings_2a (Pressure) / 2b (Flow) / 2c (Advanced) as the editor
// background depending on the loaded profile; we pick the matching image and
// overlay a title + a full-area tap zone that opens the working steps editor.
const P2ALL = ['settings_2a', 'settings_2b', 'settings_2c'];
const advEls = [
  V(P2ALL, 60, 245, { size: 50, weight: 'bold', fill: C.title, bind: (l) => `${l.profType || ''} profile: ${l.profTitle || '—'}` }),
  V(['settings_2c'], 60, 350, { size: 30, fill: C.muted, width: 900, bind: (l) => l.profSteps || '' }),
  V(P2ALL, 1290, 100, { anchor: 'w', size: 30, fill: C.val, bind: () => 'Tap the editor to change steps ✎' }),
  B(P2ALL, [40, 200, 2540, 1380], 'openEditor'),
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
    settings_message: 'settings_message.png' },
  elements: [...tabBar, ...machineEls, ...appEls, ...presetEls, ...advEls],
};

let host, live, curTab = 'machine', hooks = {}, opened = false;
export const isSettingsOpen = () => opened;
export async function settingsGoto(tab) { if (opened) await goto(tab); }       // route-driven tab switch
export function closeSettings() { if (!opened) return; cleanup(); closeOverlay(); opened = false; } // route-driven close (no onClose)

export async function openSettings(startTab = 'machine', h = {}) {
  hooks = h; opened = true;
  const stage = document.createElement('div');
  stage.className = 's2stage';
  stage.innerHTML = '<div class="s2page"></div>';
  openOverlay(stage);
  live = { tab: 'machine', cEspresso: '—', version: '—', coolMin: 30, keepHot: false, fw: '?',
    brightness: 100, devs: '', nPlugins: 0, presetName: '', presetDesc: '', profTitle: '', profSteps: '' };
  host = new PageHost(stage, config, actions, stage.querySelector('.s2page'));
  await goto(startTab);
}

async function goto(tab) {
  curTab = tab; live.tab = tab;
  // ADVANCED picks its background from the profile type, so load that first.
  if (tab === 'advanced') await loadAdvanced().catch((e) => logger.warn('adv', e));
  const pageId = tab === 'advanced' ? (live.advPage || 'settings_2c') : PAGES[tab];
  host.show(pageId); host.update(live);
  if (hooks.onTab) hooks.onTab(curTab);   // reflect the tab in the URL immediately (before data loads)
  closeSubPanel();                        // any open Skin/Language/etc. panel belongs to the old tab
  const box = host.page.querySelector('.s2-preset-scroll');  // list only belongs on PRESETS
  if (box) box.style.display = tab === 'presets' ? 'block' : 'none';
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
  live._presets = (rows || []).filter((r) => (r.visibility ? r.visibility === 'visible' : true))
    .map((r) => ({ id: r.id, p: r.profile || {} })).sort((a, b) => (a.p.title || '').localeCompare(b.p.title || ''));
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
  live.profSteps = steps.map((s, i) => `${i + 1}. ${s.name || s.pump}  —  ${s.pump === 'flow' ? s.flow + ' mL/s' : s.pressure + ' bar'} · ${s.seconds}s · ${s.temperature}°C`).join('\n');
}

function selectPreset(it) { live._sel = it; live.presetName = it ? (it.p.title || '') : ''; live.presetDesc = it ? (it.p.notes || '(no description)') : ''; host && host.update(live); }
// The profile list is a scrollable HTML list injected over the left card frame.
function renderPresetList() {
  const pageEl = host.page; let box = pageEl.querySelector('.s2-preset-scroll');
  if (!box) { box = document.createElement('div'); box.className = 's2-preset-scroll'; pageEl.appendChild(box); }
  box.style.display = curTab === 'presets' ? 'block' : 'none';
  box.innerHTML = '';
  (live._presets || []).forEach((it) => {
    const b = document.createElement('button');
    b.className = 's2-preset-row' + (it === live._sel ? ' sel' : '');
    b.textContent = it.p.title || 'Untitled';
    b.addEventListener('click', () => { selectPreset(it); renderPresetList(); });
    box.appendChild(b);
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
  const box = host.page.querySelector('.s2-preset-scroll'); if (box) box.style.display = curTab === 'presets' ? 'block' : 'none';
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
  checkBtn.addEventListener('click', async () => {
    checkBtn.textContent = 'Checking GitHub…';
    try {
      const gh = await githubFwVersion();
      const rel = gh > cur ? `NEWER available (v${gh} > your v${cur})` : gh === cur ? `you are up to date (v${gh})` : `GitHub is older (v${gh} < your v${cur})`;
      result.textContent = `GitHub firmware: v${gh} — ${rel}`;
      dlBtn.style.display = gh > cur ? '' : 'none'; dlBtn.dataset.gh = gh;
    } catch (e) { result.textContent = 'GitHub check failed: ' + e.message; logger.warn('gh fw', e); }
    checkBtn.textContent = 'Check GitHub for newer firmware';
  });
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
const spSection = (body, title) => { const h = spEl('p', '', title); h.style.cssText = 'font-size:34px;font-weight:700;color:#385a92;margin:26px 0 10px;'; body.appendChild(h); };
function spNumRow(body, label, val, min, max, step, save) {
  const r = spEl('div', 's2-sp-row'); r.appendChild(spEl('div', 's2-sp-name', label));
  const inp = document.createElement('input'); inp.type = 'number'; inp.value = val; inp.min = min; inp.max = max; inp.step = step;
  inp.style.cssText = 'margin-left:auto;width:220px;font-size:34px;padding:8px 12px;border-radius:10px;border:1px solid #c7cbe4;';
  inp.addEventListener('change', () => { let v = parseFloat(inp.value); if (Number.isNaN(v)) return; v = Math.min(max, Math.max(min, v)); inp.value = v;
    Promise.resolve(save(v)).then(() => toast('Saved')).catch((e) => { logger.warn('cal save', e); toast('Save failed'); }); });
  r.appendChild(inp); body.appendChild(r);
}
async function calibratePanel(body) {
  body.appendChild(spEl('p', 's2-sp-sub', 'Loading calibration settings…'));
  const [rea, machine] = await Promise.all([api.getReaSettings().catch(() => ({})), api.getMachineSettings().catch(() => ({}))]);
  body.innerHTML = '';
  spSection(body, 'Quick adjustments — flow multipliers  (reaprime /settings)');
  spNumRow(body, 'Weight flow multiplier', rea.weightFlowMultiplier ?? 1, 0.1, 3, 0.05, (v) => { rea.weightFlowMultiplier = v; return api.setReaSettings(rea); });
  spNumRow(body, 'Volume flow multiplier (s)', rea.volumeFlowMultiplier ?? 0.3, 0, 2, 0.05, (v) => { rea.volumeFlowMultiplier = v; return api.setReaSettings(rea); });
  spNumRow(body, 'Hot-water flow multiplier', rea.hotWaterFlowMultiplier ?? 0.3, 0, 2, 0.05, (v) => { rea.hotWaterFlowMultiplier = v; return api.setReaSettings(rea); });
  spSection(body, 'Quick adjustments — machine  (reaprime /machine/settings)');
  spNumRow(body, 'Tank / preheat temp (°C)', machine.tankTemp ?? 20, 0, 60, 1, (v) => { machine.tankTemp = v; return api.setMachineSettings(machine); });
  spNumRow(body, 'Fan threshold (°C)', machine.fan ?? 50, 30, 60, 1, (v) => { machine.fan = v; return api.setMachineSettings(machine); });
  spNumRow(body, 'Flush temp (°C)', machine.flushTemp ?? 25, 0, 95, 1, (v) => { machine.flushTemp = v; return api.setMachineSettings(machine); });
  const gfc = spEl('button', 's2-sp-btn', 'Graphical Flow Calibrator →');
  gfc.addEventListener('click', () => { closeSubPanel(); openGFC(); });
  body.appendChild(gfc);
  spSection(body, 'Sensor calibration');
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
  mk('Insight Dark theme', localStorage.getItem('theme') === 'dark', (v) => { const th = v ? 'dark' : 'light'; localStorage.setItem('theme', th); document.documentElement.dataset.theme = th; });
  mk('Screensaver clock', localStorage.getItem('insight_saver_clock') === '1', (v) => localStorage.setItem('insight_saver_clock', v ? '1' : '0'));
}

const actions = {
  navPresets: () => goto('presets'), navAdvanced: () => goto('advanced'), navMachine: () => goto('machine'), navApp: () => goto('app'),
  dialogOk: () => dialogClose(),
  skinPicker: () => subPanel('Skin', skinPanel), langPicker: () => subPanel('Language', langPanel),
  extPicker: () => subPanel('Extensions', extPanel), misc: () => subPanel('Misc', miscPanel),
  firmware: () => subPanel('Firmware', firmwarePanel),
  appUpdate: () => { toast('Re-pulling skins from source…'); api.updateSkins().then((r) => toast(r.ok ? 'App/skins updated from source' : 'Update failed')).catch(() => toast('Update failed')); },
  cancel: () => { cleanup(); closeOverlay(); opened = false; if (hooks.onClose) hooks.onClose(); },
  ok: () => { cleanup(); closeOverlay(); opened = false; if (hooks.onClose) hooks.onClose(); },
  // MACHINE
  editCool: () => num('Cool down after (min)', 'coolMin', 5, 240, 5, (v) => api.setPresence({ ...(live._presence || {}), sleepTimeoutMinutes: v }).catch((e) => logger.warn('presence', e))),
  toggleKeepHot: () => { live.keepHot = !live.keepHot; host.update(live); api.setPresence({ ...(live._presence || {}), userPresenceEnabled: !live.keepHot }).catch((e) => logger.warn('presence', e)); },
  clean: () => { if (confirm('Run cleaning cycle?')) api.setMachineState('cleaning').catch((e) => logger.warn('clean', e)); },
  descale: () => { if (confirm('Prepare to descale (blind basket, citric-acid solution in tank). Start descaling now?')) api.setMachineState('descaling').catch((e) => logger.warn('descale', e)); },
  calibrate: () => subPanel('Calibrate', calibratePanel),
  // APP
  editBrightness: () => num('Screen brightness (%)', 'brightness', 5, 100, 5, (v) => api.setBrightness(v)),
  searchDevices: () => api.scanDevices(false).then(() => setTimeout(() => goto('app'), 800)).catch((e) => logger.warn('scan', e)),
  docs: () => window.open('https://decentespresso.com/learn', '_blank'),
  // PRESETS / ADVANCED
  openEditor: () => openProfileEditor(() => goto('advanced')),
};
function cleanup() { closeSubPanel(); const b = host && host.page.querySelector('.s2-preset-scroll'); if (b) b.remove(); }
