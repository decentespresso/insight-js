// Profile selector / preset list — lists all profiles, lets the user pick one
// to load into the active workflow. Opened from the espresso profile title.
import * as api from '../modules/api.js';
import { openOverlay, closeOverlay } from '../modules/overlay.js';
import { logger } from '../modules/logger.js';

const el = (t, c, x) => { const n = document.createElement(t); if (c) n.className = c; if (x != null) n.textContent = x; return n; };
const typeLabel = (p) => (p.beverage_type || 'espresso');

export async function openProfileSelector(onChosen) {
  const panel = el('div', 'picker');
  panel.innerHTML = `
    <header class="picker-head">
      <button class="back-btn" id="pk-back">‹ Back</button>
      <h2>Profiles</h2>
      <input class="picker-search" id="pk-search" type="search" placeholder="Search profiles…">
    </header>
    <div class="picker-list" id="pk-list"><div class="picker-loading">Loading…</div></div>`;
  openOverlay(panel);
  panel.querySelector('#pk-back').addEventListener('click', closeOverlay);

  const listEl = panel.querySelector('#pk-list');
  const searchEl = panel.querySelector('#pk-search');
  let items = [], currentTitle = null;

  try {
    const [profiles, workflow] = await Promise.all([
      api.getProfiles('?includeHidden=true'),
      api.getWorkflow().catch(() => null),
    ]);
    currentTitle = workflow?.profile?.title || null;
    items = profiles
      .filter((r) => r.visibility ? r.visibility === 'visible' : true)
      .map((r) => ({ id: r.id, p: r.profile }))
      .sort((a, b) => (a.p.title || '').localeCompare(b.p.title || ''));
    render(items);
  } catch (e) {
    logger.error('profiles load', e);
    listEl.innerHTML = `<div class="picker-loading">Failed to load profiles: ${e.message}</div>`;
  }

  searchEl.addEventListener('input', () => {
    const q = searchEl.value.toLowerCase();
    render(items.filter((i) => (i.p.title || '').toLowerCase().includes(q) || (i.p.author || '').toLowerCase().includes(q)));
  });

  function render(list) {
    listEl.innerHTML = '';
    if (!list.length) { listEl.innerHTML = '<div class="picker-loading">No profiles</div>'; return; }
    for (const it of list) {
      const row = el('button', 'picker-item');
      if (it.p.title === currentTitle) row.classList.add('current');
      row.innerHTML = `
        <div class="pi-main">
          <span class="pi-title">${escapeHtml(it.p.title || 'Untitled')}</span>
          <span class="pi-type">${typeLabel(it.p)}</span>
        </div>
        <div class="pi-notes">${escapeHtml((it.p.notes || '').slice(0, 140))}</div>
        <div class="pi-author">${escapeHtml(it.p.author || '')}</div>`;
      row.addEventListener('click', () => choose(it));
      listEl.appendChild(row);
    }
  }

  async function choose(it) {
    try {
      await api.updateWorkflow({ profile: it.p });
      logger.info('profile loaded:', it.p.title);
      closeOverlay();
      onChosen && onChosen(it.p);
    } catch (e) {
      logger.error('load profile', e);
      alert(`Could not load profile: ${e.message}`);
    }
  }
}

function escapeHtml(s) { return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }
