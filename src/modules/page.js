// Image-backed page renderer for the pixel-faithful Insight port.
// Authoring space is the native 2560x1600 Insight coordinate system; the #page
// canvas is that size and CSS-scaled to fit #stage, so all element coordinates
// are used verbatim from skin.tcl. Elements: tap-zone buttons, live-text
// variables (bound to a `live` value object), and graph mounts.
import { logger } from './logger.js';

export const BASE_W = 2560, BASE_H = 1600;

// --- Insight Dark theme -------------------------------------------------------
// The dark theme swaps in the "Insight Dark" background image set (assets/
// insight-dark/) for pages that have a dark variant, and remaps the light-theme
// overlay text colours (dark ink on light cards) to light ink for the dark cards.
// Colours are keyed by the exact hex values the page configs use, so no config
// needs to know about theming — PageHost repaints when a dark page is shown.
export const curTheme = () => (document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light');
const DARK_INK = {
  '#42465c': '#d6d9e4', '#2d3046': '#eceef6', '#5a5d75': '#c2c6d4', '#646a7c': '#c8ccda',
  '#4c4f5c': '#c8ccda', '#969eb1': '#8b93a6', '#7e8496': '#9aa2b5', '#9aa0b0': '#b6bcca',
  '#4979e9': '#6c9bff', '#5a5d75dd': '#c2c6d4', '#3d4468': '#c8ccda', '#b06a6a': '#e08d8d',
};
const paintDark = (hex) => DARK_INK[(hex || '').toLowerCase()] || hex;

// Tk anchor -> CSS transform (which corner of the box sits on x,y)
const ANCHOR = {
  nw: '0,0', n: '-50%,0', ne: '-100%,0',
  w: '0,-50%', center: '-50%,-50%', e: '-100%,-50%',
  sw: '0,-100%', s: '-50%,-100%', se: '-100%,-100%',
};

export class PageHost {
  constructor(stageEl, config, actions, pageEl) {
    this.stage = stageEl;
    // page canvas defaults to the global #page (brew host), but a second host
    // (e.g. the image-backed settings dialog) can pass its own page element.
    this.page = pageEl || document.getElementById('page');
    this.config = config;               // { imgBase, pages:{id:bg}, elements:[...] }
    this.actions = actions || {};       // { actionName: fn }
    this.live = {};                     // live values for variable binds
    this.nodes = [];                    // rendered element records
    this.graphs = {};                   // graph id -> mounted controller
    this.current = null;
    this._scale();
    window.addEventListener('resize', () => this._scale());
    this._build();
  }

  _scale() {
    const s = this.stage.clientWidth / BASE_W;
    this.page.style.transform = `scale(${s})`;
  }

  _build() {
    this.page.innerHTML = '';
    this.page.style.width = BASE_W + 'px';
    this.page.style.height = BASE_H + 'px';
    for (const el of this.config.elements) {
      let node;
      if (el.kind === 'button') {
        node = document.createElement('div');
        node.className = 'tapzone';
        const [x1, y1, x2, y2] = el.rect;
        Object.assign(node.style, { left: x1 + 'px', top: y1 + 'px', width: (x2 - x1) + 'px', height: (y2 - y1) + 'px' });
        node.addEventListener('click', () => this._fire(el.action, el));
        if (el.debug) node.classList.add('tapzone-debug');
      } else if (el.kind === 'var' || el.kind === 'text') {
        node = document.createElement('div');
        node.className = 'ovar';
        const [ax, ay] = (ANCHOR[el.anchor] || ANCHOR.nw).split(',');
        Object.assign(node.style, {
          left: el.x + 'px', top: el.y + 'px', transform: `translate(${ax},${ay})`,
          font: el.font || '', color: el.fill || '#000', textAlign: el.justify || 'left',
          fontSize: (el.size ? el.size + 'px' : ''), fontFamily: el.family || "'InsightUI', Helvetica, Arial, sans-serif",
          fontWeight: el.weight || 'normal', width: el.width ? el.width + 'px' : '',
          letterSpacing: el.spacing ? el.spacing + 'px' : '',
          whiteSpace: el.wrap ? 'normal' : '', lineHeight: el.wrap ? '1.3' : '',
        });
        // clamp to N lines inside its box (used by the preset Description)
        if (el.clamp) Object.assign(node.style, { display: '-webkit-box', WebkitBoxOrient: 'vertical', WebkitLineClamp: String(el.clamp), overflow: 'hidden' });
        // fixed-height scrollable text box (scrollbar appears when it overflows)
        if (el.scroll) { Object.assign(node.style, { height: el.scroll + 'px', overflowY: 'auto', overflowX: 'hidden', pointerEvents: 'auto' }); node.classList.add('ovar-scroll'); }
        if (el.text != null) node.textContent = el.text;
      } else if (el.kind === 'box') {
        // simple styled rectangle (e.g. the steam "Enabled" toggle pill/knob)
        node = document.createElement('div');
        node.className = 'obox';
        const [x1, y1, x2, y2] = el.rect;
        Object.assign(node.style, { position: 'absolute', left: x1 + 'px', top: y1 + 'px',
          width: (x2 - x1) + 'px', height: (y2 - y1) + 'px', background: el.bg || 'transparent',
          borderRadius: (el.radius || 0) + 'px', border: el.border || 'none', pointerEvents: 'none' });
      } else if (el.kind === 'slider') {
        // horizontal drag slider (Insight's bottom flow-rate control)
        node = document.createElement('div');
        node.className = 'oslider';
        const [x1, y1, x2, y2] = el.rect;
        Object.assign(node.style, { position: 'absolute', left: x1 + 'px', top: y1 + 'px',
          width: (x2 - x1) + 'px', height: (y2 - y1) + 'px', background: el.trough || '#cfd4e6',
          borderRadius: (el.radius || 24) + 'px', cursor: 'pointer', touchAction: 'none', overflow: 'hidden' });
        const hw = el.handleW || 500;
        const handle = document.createElement('div');
        Object.assign(handle.style, { position: 'absolute', top: '0', left: '0', height: '100%',
          width: hw + 'px', background: el.fill || '#ffffff', borderRadius: (el.radius || 24) + 'px',
          boxShadow: '0 2px 10px rgba(0,0,0,0.18)', pointerEvents: 'none' });
        node.appendChild(handle);
        el._handle = handle; el._hw = hw; el._trackW = x2 - x1;
        const a = el.adj, st = a.step || 1;
        const valAt = (clientX) => { const r = node.getBoundingClientRect(); let f = (clientX - r.left) / r.width;
          f = Math.min(1, Math.max(0, f)); let v = a.min + f * (a.max - a.min); v = Math.round(v / st) * st;
          return Math.min(a.max, Math.max(a.min, +v.toFixed(4))); };
        let dragging = false;
        node.addEventListener('pointerdown', (e) => { dragging = true; try { node.setPointerCapture(e.pointerId); } catch (x) {} this._fire(el.action, el, valAt(e.clientX)); });
        node.addEventListener('pointermove', (e) => { if (dragging) this._fire(el.action, el, valAt(e.clientX)); });
        node.addEventListener('pointerup', () => { dragging = false; });
        node.addEventListener('pointercancel', () => { dragging = false; });
      } else if (el.kind === 'graph') {
        node = document.createElement('div');
        node.className = 'ographic';
        const [x1, y1, x2, y2] = el.rect;
        Object.assign(node.style, { left: x1 + 'px', top: y1 + 'px', width: (x2 - x1) + 'px', height: (y2 - y1) + 'px' });
        el._mounted = false;
      }
      node.style.display = 'none';
      this.page.appendChild(node);
      this.nodes.push({ el, node });
    }
  }

  registerGraph(id, mountFn) { this._graphMount = this._graphMount || {}; this._graphMount[id] = mountFn; }

  _fire(action, el, extra) {
    const fn = this.actions[action];
    if (fn) { fn(el, this, extra); }
    else logger.warn('no action for', action);
  }

  show(pageId) {
    if (!this.config.pages[pageId]) { logger.warn('unknown page', pageId); return; }
    this.current = pageId;
    const img = this.config.pages[pageId].replace(/\.(png|jpe?g)$/i, '.avif');
    // Dark theme: use the dark image set + dark ink for pages that have a dark
    // variant (config.darkImages). Pages without one (e.g. settings) stay light.
    const stem = img.replace(/\.avif$/i, '');
    this._dark = curTheme() === 'dark' && this.config.darkBase && this.config.darkImages && this.config.darkImages.has(stem);
    const base = this._dark ? this.config.darkBase : this.config.imgBase;
    this.page.style.backgroundImage = `url("${base}${img}")`;
    for (const { el, node } of this.nodes) {
      const on = (el.pages.includes(pageId) || el.pages.includes('*')) && !(el.notPages && el.notPages.includes(pageId));
      // clamped text needs display:-webkit-box (for -webkit-line-clamp); everything else is block
      node.style.display = on ? (el.clamp ? '-webkit-box' : 'block') : 'none';
      if (on && el.kind === 'graph' && !el._mounted && this._graphMount && this._graphMount[el.id]) {
        this.graphs[el.id] = this._graphMount[el.id](node);
        el._mounted = true;
      }
    }
    this.update();
  }

  update(live) {
    if (live) this.live = live;
    for (const { el, node } of this.nodes) {
      if (node.style.display === 'none') continue;
      if (el.kind === 'var' && el.bind) {
        try { node.textContent = el.bind(this.live) ?? ''; } catch (e) { /* ignore */ }
      }
      if (el.kind === 'var') {
        // resolve the colour (dynamic fillBind wins) then remap for the dark theme
        let c = el.fill || '#000';
        if (el.fillBind) { try { c = el.fillBind(this.live) || el.fill || '#000'; } catch (e) { /* ignore */ } }
        node.style.color = this._dark ? paintDark(c) : c;
      }
      if (el.kind === 'box' && el.bind) {
        try { const s = el.bind(this.live) || {}; if (s.bg) node.style.background = s.bg; if (s.left != null) node.style.left = s.left + 'px'; } catch (e) { /* ignore */ }
      }
      if (el.kind === 'slider' && el.valueBind) {
        try { const a = el.adj; let f = (el.valueBind(this.live) - a.min) / (a.max - a.min);
          f = Math.min(1, Math.max(0, f)); el._handle.style.left = (f * (el._trackW - el._hw)) + 'px'; } catch (e) { /* ignore */ }
      }
    }
  }
}
