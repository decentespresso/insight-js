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
export const getProfiles = (opts = '') => j('GET', `/profiles${opts}`);
export const getLatestShot = () => j('GET', '/shots/latest');
export const updateShot = (id, data) => j('PUT', `/shots/${encodeURIComponent(id)}`, data);
export const getProfile = (id) => j('GET', `/profiles/${encodeURIComponent(id)}`);
export const saveProfile = (profile) => j('POST', '/profiles', { profile });
export const getMachineSettings = () => j('GET', '/machine/settings');
export const setMachineSettings = (s) => j('POST', '/machine/settings', s);
export const setShotSettings = (s) => j('POST', '/machine/shotSettings', s);
export const getReaSettings = () => j('GET', '/settings');
export const setReaSettings = (s) => j('POST', '/settings', s);

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
