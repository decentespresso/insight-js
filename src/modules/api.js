// Thin Decent.app (reaprime) REST + WebSocket client for the Insight skin.
// Base derives from the page host so the skin works both served-in-app and
// served from a dev static server on the same machine as the gateway.
import { logger } from './logger.js';

export const reaHostname = localStorage.getItem('reaHostname') || window.location.hostname || 'localhost';
export const REA_PORT = 8080;
export const API_BASE = `http://${reaHostname}:${REA_PORT}/api/v1`;
const WS_PROTO = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
const WS_BASE = `${WS_PROTO}//${reaHostname}:${REA_PORT}/ws/v1`;

export const MachineState = {
  BOOTING: 'booting', IDLE: 'idle', SLEEPING: 'sleeping', HEATING: 'heating',
  PREHEATING: 'preheating', ESPRESSO: 'espresso', HOT_WATER: 'hotWater',
  FLUSH: 'flush', STEAM: 'steam', STEAM_RINSE: 'steamRinse',
  CLEANING: 'cleaning', DESCALING: 'descaling', NEEDS_WATER: 'needsWater', ERROR: 'error',
};

async function j(method, path, body) {
  const opts = { method };
  if (body !== undefined) { opts.headers = { 'Content-Type': 'application/json' }; opts.body = JSON.stringify(body); }
  const r = await fetch(`${API_BASE}${path}`, opts);
  if (!r.ok) throw new Error(`${method} ${path} -> ${r.status}`);
  const t = await r.text();
  return t ? JSON.parse(t) : null;
}

export const getMachineInfo = () => j('GET', '/machine/info');
export const getMachineState = () => j('GET', '/machine/state');
export const getWorkflow = () => j('GET', '/workflow');
export const updateWorkflow = (partial) => j('PUT', '/workflow', partial); // deep-merged by gateway
export const setMachineState = (s) => fetch(`${API_BASE}/machine/state/${s}`, { method: 'PUT' });
export const tareScale = () => fetch(`${API_BASE}/scale/tare`, { method: 'PUT' });
export const getDevices = () => j('GET', '/devices');
export const scanDevices = (connect = false) => j('GET', `/devices/scan?connect=${connect}&quick=true`);
export const connectDevice = (id) => fetch(`${API_BASE}/devices/connect?deviceId=${encodeURIComponent(id)}`, { method: 'PUT' });
export const getShotIds = () => j('GET', '/shots/ids');
export const getPlugins = () => j('GET', '/plugins');
export const getPresence = () => j('GET', '/presence/settings');
export const setPresence = (s) => j('POST', '/presence/settings', s);
export const getProfiles = (opts = '') => j('GET', `/profiles${opts}`);
export const getLatestShot = () => j('GET', '/shots/latest');
export const updateShot = (id, data) => j('PUT', `/shots/${encodeURIComponent(id)}`, data);
export const getProfile = (id) => j('GET', `/profiles/${encodeURIComponent(id)}`);
export const saveProfile = (profile) => j('POST', '/profiles', { profile });
export const updateProfile = (id, profile) => j('PUT', `/profiles/${encodeURIComponent(id)}`, { profile }); // rename / edit metadata
export const deleteProfile = (id) => fetch(`${API_BASE}/profiles/${encodeURIComponent(id)}`, { method: 'DELETE' }); // soft delete
export const setProfileVisibility = (id, visibility) => j('PUT', `/profiles/${encodeURIComponent(id)}/visibility`, { visibility }); // visible|hidden|deleted
export const getMachineSettings = () => j('GET', '/machine/settings');
export const setMachineSettings = (s) => j('POST', '/machine/settings', s);
export const setShotSettings = (s) => j('POST', '/machine/shotSettings', s);
export const getReaSettings = () => j('GET', '/settings');
export const setReaSettings = (s) => j('POST', '/settings', s);
// App / skins / firmware — endpoints the Streamline skin uses (John's Basecamp todo).
export const getAppInfo = () => j('GET', '/info');                          // {version, buildNumber, fullVersion, commit}
export const getSkins = () => j('GET', '/webui/skins');                     // [{id,name,description,version,...}]
export const getDefaultSkin = () => j('GET', '/webui/skins/default');
export const setDefaultSkin = (skinId) => j('PUT', '/webui/skins/default', { skinId });
export const updateSkins = () => fetch(`${API_BASE}/webui/skins/update`, { method: 'POST' }); // re-pull skins from source (self-update)
export const uploadFirmware = (fileOrBuf) => fetch(`${API_BASE}/machine/firmware`, { method: 'POST', body: fileOrBuf });
export const enablePlugin = (id) => fetch(`${API_BASE}/plugins/${encodeURIComponent(id)}/enable`, { method: 'POST' });
export const disablePlugin = (id) => fetch(`${API_BASE}/plugins/${encodeURIComponent(id)}/disable`, { method: 'POST' });

// --- WebSocket streams (auto-reconnecting) ---
function stream(path, onData, label) {
  const ws = new ReconnectingWebSocket(`${WS_BASE}${path}`, [], { reconnectInterval: 3000 });
  ws.onopen = () => logger.info(`${label} WS open`);
  ws.onclose = () => logger.info(`${label} WS closed`);
  ws.onerror = (e) => logger.error(`${label} WS error`, e);
  ws.onmessage = (ev) => { try { onData(JSON.parse(ev.data)); } catch (e) { logger.error(`${label} parse`, e); } };
  return ws;
}
export const connectSnapshot = (onData) => stream('/machine/snapshot', onData, 'snapshot');
export const connectScale = (onData) => stream('/scale/snapshot', onData, 'scale');
export const connectShotSettings = (onData) => stream('/machine/shotSettings', onData, 'shotSettings');

// --- Display brightness (tablet backlight) ---
// reaprime controls the host tablet's screen brightness over the ws/v1/display
// socket with a `setBrightness` command (0-100). The Streamline skin dims to 10
// when the machine sleeps and restores to 100 on wake; we mirror that. (The REST
// /display/dim + /display/restore routes are absent on current gateway builds —
// brightness is numeric here, not "normal"/"dimmed" — so the WS is the path.)
// Only has a visible effect on Android/iOS; other platforms accept it as a no-op.
export const getDisplayState = () => j('GET', '/display');
let displayWS = null, displayReady = false;
export function connectDisplay() {
  if (displayWS) return displayWS;
  displayWS = new ReconnectingWebSocket(`${WS_BASE}/display`, [], { reconnectInterval: 3000 });
  displayWS.onopen = () => { displayReady = true; logger.info('display WS open'); };
  displayWS.onclose = () => { displayReady = false; };
  displayWS.onerror = (e) => logger.error('display WS error', e);
  return displayWS;
}
function sendDisplay(cmd) {
  const ok = displayReady && displayWS && displayWS.readyState === WebSocket.OPEN;
  if (ok) { try { displayWS.send(JSON.stringify(cmd)); } catch (e) { logger.warn('display send', e); } return; }
  // first dim can race the socket opening — retry once shortly after
  setTimeout(() => { try { displayWS && displayWS.send(JSON.stringify(cmd)); } catch (e) { logger.warn('display send (retry)', e); } }, 200);
}
export const setBrightness = (n) => sendDisplay({ command: 'setBrightness', brightness: n });
export const dimDisplay = () => setBrightness(10);
export const restoreDisplay = () => setBrightness(100);
