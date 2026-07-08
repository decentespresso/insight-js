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
