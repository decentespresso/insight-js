// Temporary placeholder for brew screens not yet built (M2–M4). Replaced by
// real flush/steam/water views. Keeps tab-switching functional meanwhile.
export function createStubView(name) {
  return function () {
    let root;
    return {
      mount(c) { root = document.createElement('div'); root.className = 'brew-screen stub';
        root.innerHTML = `<div class="stub-msg">${name} screen — coming next</div>`; c.appendChild(root); },
      onSnapshot() {}, onScale() {}, onShow() {}, unmount() { root?.remove(); },
    };
  };
}
