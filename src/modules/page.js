// Image-backed page renderer for the pixel-faithful Insight port.
// Authoring space is the native 2560x1600 Insight coordinate system; the #page
// canvas is that size and CSS-scaled to fit #stage, so all element coordinates
// are used verbatim from skin.tcl. Elements: tap-zone buttons, live-text
// variables (bound to a `live` value object), and graph mounts.
import { logger } from './logger.js';

export const BASE_W = 2560, BASE_H = 1600;

// Tk anchor -> CSS transform (which corner of the box sits on x,y)
const ANCHOR = {
  nw: '0,0', n: '-50%,0', ne: '-100%,0',
  w: '0,-50%', center: '-50%,-50%', e: '-100%,-50%',
  sw: '0,-100%', s: '-50%,-100%', se: '-100%,-100%',
};

export class PageHost {
  constructor(stageEl, config, actions) {
    this.stage = stageEl;
    this.page = document.getElementById('page');
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
          fontSize: (el.size ? el.size + 'px' : ''), fontFamily: el.family || 'Helvetica, Arial, sans-serif',
          fontWeight: el.weight || 'normal', width: el.width ? el.width + 'px' : '',
        });
        if (el.text != null) node.textContent = el.text;
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

  _fire(action, el) {
    const fn = this.actions[action];
    if (fn) { logger.info('tap:', action); fn(el, this); }
    else logger.warn('no action for', action);
  }

  show(pageId) {
    if (!this.config.pages[pageId]) { logger.warn('unknown page', pageId); return; }
    this.current = pageId;
    const img = this.config.pages[pageId].replace(/\.(png|jpe?g)$/i, '.avif');
    this.page.style.backgroundImage = `url("${this.config.imgBase}${img}")`;
    for (const { el, node } of this.nodes) {
      const on = el.pages.includes(pageId) || el.pages.includes('*');
      node.style.display = on ? (el.kind === 'button' ? 'block' : (el.kind === 'graph' ? 'block' : 'block')) : 'none';
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
      if ((el.kind === 'var') && el.bind) {
        try { node.textContent = el.bind(this.live) ?? ''; } catch (e) { /* ignore */ }
      }
    }
  }
}
