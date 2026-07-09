// Simple full-screen overlay layer mounted over the stage, used for the profile
// selector, editors, DYE, settings, etc.
let host;
function ensure() {
  if (!host) {
    host = document.createElement('div');
    host.id = 'overlay';
    document.getElementById('stage').appendChild(host);
  }
  return host;
}
export function openOverlay(node) {
  const h = ensure();
  h.innerHTML = '';
  h.appendChild(node);
  h.classList.add('open');
}
export function closeOverlay() { host && host.classList.remove('open'); }

// Stacking modal layer — sits ABOVE the main overlay so a numpad opened from
// inside the settings editor doesn't wipe it. Separate node, appended last.
let modalHost;
export function openModal(node) {
  if (!modalHost) { modalHost = document.createElement('div'); modalHost.id = 'modal'; document.getElementById('stage').appendChild(modalHost); }
  document.getElementById('stage').appendChild(modalHost);   // keep it on top
  modalHost.innerHTML = '';
  modalHost.appendChild(node);
  modalHost.classList.add('open');
}
export function closeModal() { modalHost && (modalHost.classList.remove('open'), (modalHost.innerHTML = '')); }
