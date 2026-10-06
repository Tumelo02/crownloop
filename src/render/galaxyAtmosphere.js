/**
 * The alien GALAXY surface, kept deliberately quiet (readability first):
 *   - haze:     soft tinted pools of light (cyan / violet / teal) instead of neutral white
 *   - currents: barely visible energy currents that drift very slowly
 *   - dust:     sparse cosmic dust with a little parallax (it moves slower than the world)
 *   - organic:  a living, cellular texture laid INSIDE territory (TerritorySystem)
 * Everything is pre-rendered once into small tiles and drawn as patterns: two pattern
 * fills per frame for the floor, one clipped fill per visible territory owner. No grid,
 * no planets, no nebula, nothing that moves faster than the players.
 */

import { currentFloor, onFloorChange } from './floorThemes.js';

const TAU = Math.PI * 2;
let tiles = null;

function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function makeCanvas(size) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  return c;
}

/** Draws something three times, wrapped, so the tile repeats seamlessly. */
function wrapped(size, fn) {
  for (const dx of [-size, 0, size]) for (const dy of [-size, 0, size]) fn(dx, dy);
}

function buildTiles() {
  const r = rng(7);

  // Energy currents: a few long, soft, sinuous ribbons.
  const currents = makeCanvas(1024);
  {
    const ctx = currents.getContext('2d');
    ctx.filter = 'blur(18px)';
    ctx.lineCap = 'round';
    for (let i = 0; i < 4; i++) {
      const y0 = r() * 1024;
      const amp = 60 + r() * 120;
      const hue = r() < 0.5 ? 190 : 268;
      ctx.strokeStyle = `hsla(${hue}, 60%, 60%, ${0.016 + r() * 0.012})`;
      ctx.lineWidth = 34 + r() * 40;
      const phase = r() * TAU;
      wrapped(1024, (dx, dy) => {
        ctx.beginPath();
        for (let x = -40; x <= 1064; x += 16) {
          const y = y0 + Math.sin(x / 1024 * TAU * 2 + phase) * amp;
          if (x === -40) ctx.moveTo(x + dx, y + dy);
          else ctx.lineTo(x + dx, y + dy);
        }
        ctx.stroke();
      });
    }
    ctx.filter = 'none';
  }

  // Cosmic dust: sparse, tiny, cool-tinted specks (a few with a faint halo).
  const dust = makeCanvas(768);
  {
    const ctx = dust.getContext('2d');
    for (let i = 0; i < 170; i++) {
      const x = r() * 768;
      const y = r() * 768;
      const big = r() < 0.08;
      const rad = big ? 1.6 + r() * 1.2 : 0.5 + r() * 0.9;
      const hue = [196, 262, 174, 300][Math.floor(r() * 4)];
      const a = big ? 0.22 : 0.08 + r() * 0.14;
      wrapped(768, (dx, dy) => {
        if (big) {
          const g = ctx.createRadialGradient(x + dx, y + dy, 0, x + dx, y + dy, rad * 5);
          g.addColorStop(0, `hsla(${hue}, 80%, 60%, ${a * 0.5})`);
          g.addColorStop(1, `hsla(${hue}, 80%, 60%, 0)`);
          ctx.fillStyle = g;
          ctx.fillRect(x + dx - rad * 5, y + dy - rad * 5, rad * 10, rad * 10);
        }
        ctx.fillStyle = `hsla(${hue}, 55%, 42%, ${a})`;
        ctx.beginPath();
        ctx.arc(x + dx, y + dy, rad, 0, TAU);
        ctx.fill();
      });
    }
  }

  // Organic territory texture: soft cells + fine veins (neutral light/dark, so it takes
  // on each owner's colour when laid over their fill).
  const organic = makeCanvas(512);
  {
    const ctx = organic.getContext('2d');
    for (let i = 0; i < 46; i++) {
      const x = r() * 512;
      const y = r() * 512;
      const rad = 22 + r() * 46;
      wrapped(512, (dx, dy) => {
        // Soft light cells only (no rims): an organic glow, never bubbles or tiles.
        const g = ctx.createRadialGradient(x + dx, y + dy, 0, x + dx, y + dy, rad);
        g.addColorStop(0, 'rgba(255, 255, 255, 0.13)');
        g.addColorStop(0.6, 'rgba(255, 255, 255, 0.04)');
        g.addColorStop(1, 'rgba(255, 255, 255, 0)');
        ctx.fillStyle = g;
        ctx.fillRect(x + dx - rad, y + dy - rad, rad * 2, rad * 2);
      });
    }
    ctx.lineCap = 'round';
    for (let i = 0; i < 14; i++) {
      let x = r() * 512;
      let y = r() * 512;
      let a = r() * TAU;
      ctx.strokeStyle = `rgba(255, 255, 255, ${0.07 + r() * 0.05})`;
      ctx.lineWidth = 1 + r() * 1.4;
      const pts = [];
      for (let k = 0; k < 9; k++) {
        pts.push([x, y]);
        a += (r() - 0.5) * 1.1;
        x += Math.cos(a) * 26;
        y += Math.sin(a) * 26;
      }
      wrapped(512, (dx, dy) => {
        ctx.beginPath();
        pts.forEach(([px, py], k) => (k === 0 ? ctx.moveTo(px + dx, py + dy) : ctx.lineTo(px + dx, py + dy)));
        ctx.stroke();
      });
    }
  }

  return { currents, dust, organic, haze: buildHaze(currentFloor()), patterns: new WeakMap() };
}

/** Haze pools in the current floor theme's three tints (alternating across the lattice). */
function buildHaze(floor) {
  const { hazeSat: s, hazeLight: l, hazeAlpha: a } = floor;
  return floor.haze.map((hue) => {
    const c = makeCanvas(128);
    const ctx = c.getContext('2d');
    const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
    g.addColorStop(0, `hsla(${hue}, ${s}%, ${l}%, ${a})`);
    g.addColorStop(0.55, `hsla(${hue}, ${s}%, ${l + 4}%, ${a * 0.43})`);
    g.addColorStop(1, `hsla(${hue}, ${s}%, ${l + 8}%, 0)`);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 128, 128);
    return c;
  });
}

onFloorChange((floor) => {
  if (tiles) tiles.haze = buildHaze(floor);
});

function getTiles() {
  if (!tiles) tiles = buildTiles();
  return tiles;
}

function patternFor(ctx, name) {
  const t = getTiles();
  let byCtx = t.patterns.get(ctx);
  if (!byCtx) {
    byCtx = {};
    t.patterns.set(ctx, byCtx);
  }
  if (!byCtx[name]) byCtx[name] = ctx.createPattern(t[name], 'repeat');
  return byCtx[name];
}

/** A tinted haze sprite for a floor-lattice cell (stable per cell). */
export function hazeSprite(col, row) {
  const t = getTiles();
  return t.haze[Math.abs((col * 7 + row * 13) % t.haze.length)];
}

/**
 * Currents (slow drift) and dust (slight parallax) over the visible floor rectangle.
 * @param {{x:number,y:number}} cam camera centre (world units)
 */
export function drawGalaxyBackdrop(ctx, x0, y0, x1, y1, cam, time) {
  const currents = patternFor(ctx, 'currents');
  const dust = patternFor(ctx, 'dust');
  if (currents.setTransform) currents.setTransform(new DOMMatrix([1, 0, 0, 1, time * 5, time * 2.5]));
  ctx.fillStyle = currents;
  ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
  // Dust drifts at 85% of the world's speed relative to the camera: a sense of depth.
  if (dust.setTransform) dust.setTransform(new DOMMatrix([1, 0, 0, 1, cam.x * 0.15 + time * 1.5, cam.y * 0.15]));
  ctx.fillStyle = dust;
  ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
}

/** The organic "living land" pattern, slowly flowing, for TerritorySystem. */
export function organicPattern(ctx, time) {
  const p = patternFor(ctx, 'organic');
  if (p.setTransform) p.setTransform(new DOMMatrix([1, 0, 0, 1, Math.sin(time * 0.15) * 30, time * 3]));
  return p;
}
