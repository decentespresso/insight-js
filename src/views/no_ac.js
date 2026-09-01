// Front-standby-switch ("no AC") page. The DE1 reports substate Error_NoAC
// (217, "Front button off") while the standby switch on the FRONT of the machine
// is cutting AC power to the heater — so it can't do anything until the switch is
// pushed back on. de1app shows a dedicated page for this instead of an error;
// this is the Insight port: the front-button photo with "Push the switch on",
// and a tap anywhere dismisses it (advisory — the rest of the UI stays reachable
// until the switch state actually changes).
import { t } from '../modules/i18n.js';

let el = null;

export function isNoAcOpen() { return el != null; }

export function openNoAc(onDismiss) {
  if (el) return;
  el = document.createElement('div');
  el.id = 'no-ac';
  el.style.cssText = 'position:absolute;inset:0;z-index:40;cursor:pointer;overflow:hidden;'
    + 'background:#2a2c31 url("assets/insight/front_button.avif") center/cover no-repeat;';
  const label = document.createElement('div');
  label.className = 'no-ac-label';
  label.textContent = t('Push the switch on');
  el.appendChild(label);
  el.addEventListener('click', () => { closeNoAc(); if (onDismiss) onDismiss(); });
  document.getElementById('stage').appendChild(el);
}

export function closeNoAc() {
  if (!el) return;
  el.remove(); el = null;
}
