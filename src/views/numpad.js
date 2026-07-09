// Full-screen numeric data-entry page (faithful to Insight's number editor):
// a title, a stepper row (min / -10 / -1 / value / +1 / +10 / max), a
// "Previous values" list, a keypad, and Cancel / Ok. Opened by tapping a value
// label (flush auto-off, water volume/temp, steam auto-off).
import { openModal, closeModal } from '../modules/overlay.js';
import { t } from '../modules/i18n.js';

const el = (tag, css, txt) => { const n = document.createElement(tag); if (css) n.style.cssText = css; if (txt != null) n.textContent = txt; return n; };
const prevKey = (k) => `numpad_prev_${k}`;
const loadPrev = (k) => { try { return JSON.parse(localStorage.getItem(prevKey(k)) || '[]'); } catch (e) { return []; } };
const savePrev = (k, v) => { const l = loadPrev(k).filter((x) => x !== v); l.unshift(v); localStorage.setItem(prevKey(k), JSON.stringify(l.slice(0, 8))); };

// opts: { title, value, min, max, step, bigStep, decimals, unit, onOk(value) }
export function openNumpad(opts) {
  const o = Object.assign({ min: 0, max: 999, step: 1, bigStep: 10, decimals: 0, unit: '' }, opts);
  let entry = String(o.value);          // current text in the value box
  let typing = false;                   // true once the user starts typing digits

  const root = el('div', 'position:absolute;inset:0;display:flex;flex-direction:column;background:#eef0f7;font-family:\'InsightUI\',Helvetica,Arial,sans-serif;-webkit-font-smoothing:antialiased;');

  // ---- header ----
  const header = el('div', 'text-align:center;padding:20px;font-size:30px;font-weight:700;color:#42465c;letter-spacing:1px;');
  header.textContent = o.title;
  root.appendChild(header);

  const body = el('div', 'flex:1;display:flex;gap:20px;padding:0 24px;min-height:0;');
  root.appendChild(body);

  // ---- left column ----
  const left = el('div', 'flex:1;display:flex;flex-direction:column;gap:20px;min-width:0;');
  body.appendChild(left);

  const stepCard = el('div', 'background:#fff;border-radius:10px;padding:22px;display:flex;align-items:center;justify-content:center;gap:12px;');
  const clamp = (v) => Math.min(o.max, Math.max(o.min, v));
  const fmt = (v) => Number(v).toFixed(o.decimals);
  const valBox = el('div', 'min-width:90px;height:66px;padding:0 12px;border:2px solid var(--ins-green,#7ea63a);border-radius:6px;display:flex;align-items:center;justify-content:center;font-size:34px;color:#42465c;background:#fff;');
  valBox.textContent = entry;
  const setEntry = (v, isTyping) => { entry = String(v); typing = !!isTyping; valBox.textContent = entry; };
  const stepBtn = (label, sub, fn) => {
    const b = el('button', 'width:78px;height:78px;border:none;border-radius:8px;background:#e7e9f4;color:#5a5d75;font-size:26px;cursor:pointer;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;');
    b.appendChild(el('div', 'font-size:26px;', label));
    b.appendChild(el('div', 'font-size:15px;color:#969eb1;', sub));
    b.addEventListener('click', fn);
    return b;
  };
  const cur = () => (typing ? parseFloat(entry || '0') || 0 : parseFloat(entry) || 0);
  const bump = (d) => setEntry(fmt(clamp(cur() + d)), false);
  stepCard.appendChild(stepBtn('⇤', String(o.min), () => setEntry(fmt(o.min), false)));
  stepCard.appendChild(stepBtn('«', '-' + o.bigStep, () => bump(-o.bigStep)));
  stepCard.appendChild(stepBtn('‹', '-' + o.step, () => bump(-o.step)));
  stepCard.appendChild(valBox);
  stepCard.appendChild(stepBtn('›', '+' + o.step, () => bump(o.step)));
  stepCard.appendChild(stepBtn('»', '+' + o.bigStep, () => bump(o.bigStep)));
  stepCard.appendChild(stepBtn('⇥', String(o.max), () => setEntry(fmt(o.max), false)));
  left.appendChild(stepCard);

  // accept a value: save to history, apply, close (used by Ok and previous-value taps)
  const submit = (v) => { v = clamp(v); savePrev(o.title, v); o.onOk(v); closeModal(); };

  // ---- previous values ----
  const prevCard = el('div', 'flex:1;background:#fff;border-radius:10px;padding:22px;display:flex;flex-direction:column;min-height:0;');
  prevCard.appendChild(el('div', 'text-align:center;color:#969eb1;font-size:24px;margin-bottom:24px;', t('Previous values')));
  const prevList = el('div', 'flex:1;display:flex;flex-wrap:wrap;gap:10px;align-content:flex-start;overflow-y:auto;');
  for (const v of loadPrev(o.title)) {
    const p = el('button', 'padding:20px 42px;font-size:40px;min-width:120px;border:1px solid #dfe1ec;border-radius:8px;background:#f6f7fb;color:#42465c;cursor:pointer;', fmt(v));
    p.addEventListener('click', () => submit(v));   // tapping a previous value submits it directly
    prevList.appendChild(p);
  }
  prevCard.appendChild(prevList);
  left.appendChild(prevCard);

  // ---- keypad ----
  const pad = el('div', 'flex:1;background:#fff;border-radius:10px;padding:22px;display:grid;grid-template-columns:repeat(3,1fr);grid-auto-rows:1fr;gap:16px;');
  const typeDigit = (d) => {
    if (!typing) { entry = ''; typing = true; }
    if (d === '.' && (o.decimals === 0 || entry.includes('.'))) return;
    entry = (entry + d).slice(0, 7);
    valBox.textContent = entry || '0';
  };
  const keyBtn = (label, fn, dim) => {
    const b = el('button', `border:none;border-radius:10px;background:${dim ? '#e2e3e8' : '#b9bde0'};color:#fff;font-size:40px;cursor:pointer;`, label);
    if (dim) b.style.color = '#b9bde0';
    b.addEventListener('click', fn);
    return b;
  };
  ['7', '8', '9', '4', '5', '6', '1', '2', '3'].forEach((d) => pad.appendChild(keyBtn(d, () => typeDigit(d))));
  pad.appendChild(keyBtn('Del', () => { entry = typing ? entry.slice(0, -1) : ''; typing = true; valBox.textContent = entry || '0'; }));
  pad.appendChild(keyBtn('0', () => typeDigit('0')));
  pad.appendChild(keyBtn('.', () => typeDigit('.'), o.decimals === 0));
  body.appendChild(pad);

  // ---- footer ----
  const footer = el('div', 'display:flex;gap:20px;justify-content:center;padding:22px;');
  const foot = (label, primary, fn) => {
    const b = el('button', `width:230px;height:64px;border:none;border-radius:10px;font-size:28px;cursor:pointer;background:${primary ? '#c9cef0' : '#dfe1ec'};color:${primary ? '#42465c' : '#8a90a2'};`, label);
    b.addEventListener('click', fn);
    return b;
  };
  footer.appendChild(foot(t('Cancel'), false, () => closeModal()));
  footer.appendChild(foot(t('Ok'), true, () => submit(parseFloat(entry) || o.min)));
  root.appendChild(footer);

  openModal(root);
}
