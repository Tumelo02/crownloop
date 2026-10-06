/**
 * Arena floor themes (presentation only; chosen in Settings, remembered per browser).
 * Each theme is the ground's base colour, the three tints of its haze pools, and the
 * colour of the cell circles (one per 40-unit domain cell, see ArenaRenderer).
 * `dark` floors get lighter domain borders and stronger fills (TerritorySystem.registerSlot).
 * Dark floors come first: they make domains, tethers and flux glow. `price` is in sigils
 * (Store > Floors); 0 = free for everyone.
 */
export const FLOORS = Object.freeze([
  Object.freeze({
    id: 'abyss', price: 0, name: 'Abyssal Shelf', base: '#262d42', dark: true,
    haze: [192, 268, 168], hazeSat: 70, hazeLight: 46, hazeAlpha: 0.32, cell: 'rgba(150, 215, 255, 0.12)',
  }),
  Object.freeze({
    id: 'eclipse', price: 4000, name: 'Eclipse Plain', base: '#12151e', dark: true,
    haze: [215, 240, 195], hazeSat: 60, hazeLight: 40, hazeAlpha: 0.3, cell: 'rgba(170, 200, 255, 0.1)',
  }),
  Object.freeze({
    id: 'nebula', price: 6000, name: 'Nebula Bloom', base: '#231a3a', dark: true,
    haze: [290, 322, 250], hazeSat: 70, hazeLight: 46, hazeAlpha: 0.32, cell: 'rgba(225, 185, 255, 0.11)',
  }),
  Object.freeze({
    id: 'reef', price: 4500, name: 'Midnight Reef', base: '#0f2a33', dark: true,
    haze: [176, 198, 150], hazeSat: 70, hazeLight: 40, hazeAlpha: 0.32, cell: 'rgba(140, 255, 230, 0.1)',
  }),
  Object.freeze({
    id: 'obsidian', price: 5500, name: 'Obsidian Wastes', base: '#1e1d24', dark: true,
    haze: [18, 350, 36], hazeSat: 75, hazeLight: 40, hazeAlpha: 0.3, cell: 'rgba(255, 190, 150, 0.1)',
  }),
  Object.freeze({
    id: 'basalt', price: 5000, name: 'Crimson Basalt', base: '#2a1a20', dark: true,
    haze: [350, 12, 330], hazeSat: 65, hazeLight: 38, hazeAlpha: 0.3, cell: 'rgba(255, 170, 185, 0.1)',
  }),
  Object.freeze({
    id: 'verdigris', price: 4500, name: 'Verdigris Hollow', base: '#142a24', dark: true,
    haze: [150, 120, 175], hazeSat: 55, hazeLight: 38, hazeAlpha: 0.3, cell: 'rgba(170, 255, 210, 0.1)',
  }),
  Object.freeze({
    id: 'frost', price: 0, name: 'Frost Plains', base: '#ecf0f6',
    haze: [190, 270, 168], hazeSat: 85, hazeLight: 82, hazeAlpha: 0.28, cell: 'rgba(70, 95, 145, 0.13)',
  }),
  Object.freeze({
    id: 'dune', price: 2500, name: 'Ochre Dunes', base: '#f0e4d0',
    haze: [28, 12, 46], hazeSat: 80, hazeLight: 76, hazeAlpha: 0.3, cell: 'rgba(140, 95, 45, 0.14)',
  }),
  Object.freeze({
    id: 'lichen', price: 2500, name: 'Lichen Moor', base: '#e1eadd',
    haze: [120, 168, 84], hazeSat: 55, hazeLight: 74, hazeAlpha: 0.3, cell: 'rgba(65, 110, 70, 0.14)',
  }),
  Object.freeze({
    id: 'amethyst', price: 3000, name: 'Amethyst Flats', base: '#ebe5f3',
    haze: [278, 318, 236], hazeSat: 70, hazeLight: 80, hazeAlpha: 0.3, cell: 'rgba(105, 75, 150, 0.13)',
  }),
]);

const STORAGE_KEY = 'dominion.floor';
let current = FLOORS[0];
try {
  const saved = localStorage.getItem(STORAGE_KEY);
  current = FLOORS.find((f) => f.id === saved) || FLOORS[0];
} catch { /* storage unavailable: default floor */ }

const listeners = new Set();

export const DEFAULT_FLOOR_ID = 'abyss';

export function currentFloor() {
  return current;
}

export function setFloor(id) {
  const next = FLOORS.find((f) => f.id === id);
  if (!next || next === current) return;
  current = next;
  try { localStorage.setItem(STORAGE_KEY, id); } catch { /* not persisted */ }
  for (const fn of listeners) fn(current);
}

/** Called with the new theme whenever the floor changes. */
export function onFloorChange(fn) {
  listeners.add(fn);
}
