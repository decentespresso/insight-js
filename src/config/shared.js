// Shared chrome present on every page: the top mode-nav bar and the bottom
// sleep/settings buttons. pages:['*'] => shown on all pages.
export const sharedElements = [
  { kind: 'button', pages: ['*'], rect: [0, 0, 641, 188], action: 'navFlush' },
  { kind: 'button', pages: ['*'], rect: [642, 0, 1277, 188], action: 'navEspresso' },
  { kind: 'button', pages: ['*'], rect: [1278, 0, 1904, 188], action: 'navSteam' },
  { kind: 'button', pages: ['*'], rect: [1905, 0, 2560, 188], action: 'navWater' },
  { kind: 'button', pages: ['*'], rect: [2014, 1420, 2284, 1600], action: 'sleep' },
  { kind: 'button', pages: ['*'], rect: [2285, 1420, 2560, 1600], action: 'settings' },
];
