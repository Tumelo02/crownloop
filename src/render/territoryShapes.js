/**
 * Domain outlines over the 40-unit gameplay cells (rendering only).
 *
 * Ownership stays a cell grid (fast, exact for capture and collision). For drawing, each
 * owner's cells are outlined along their exact cell edges, and every outward edge bulges
 * softly over the floor circle it borders (ArenaRenderer draws one circle per cell). So a
 * domain covers exactly the circles it owns, with a scalloped edge that follows them:
 * close a loop and precisely the enclosed circles fill in. Where two domains meet, the
 * shared edge is curved too: the lower slot bulges out, the other follows the same curve
 * inward, so borders stay round and neighbours never overlap or leave a gap.
 *
 * The result is cached per view window as Path2D objects and rebuilt only when a cell
 * inside the window changes owner (touch / invalidate) or the camera leaves the window.
 */

const MARGIN = 6; // extra cells cached around the view, so panning rarely triggers a rebuild
const BULGE = 0.36; // outward bump per edge (control-point offset, in cells; peak = half)

export class TerritoryShapes {
  constructor(territory) {
    this.territory = territory;
    this.dirty = true;
    this.versionAll = -1;
    this.window = null; // { c0, c1, r0, r1 } cached cell window
    this.shapes = new Map(); // slot -> { path: Path2D, minX, minY, maxX, maxY }
  }

  /** A cell changed owner: rebuild only if it is inside the cached window. */
  touch(index) {
    const w = this.window;
    if (this.dirty || !w) return;
    const cols = this.territory.cols;
    const c = index % cols;
    const r = (index - c) / cols;
    if (c >= w.c0 - 1 && c <= w.c1 + 1 && r >= w.r0 - 1 && r <= w.r1 + 1) this.dirty = true;
  }

  invalidate() {
    this.dirty = true;
  }

  /** Domain shapes for the current view (rebuilt only when needed). */
  get(bounds) {
    const t = this.territory;
    if (this.versionAll !== t.versionAll) {
      this.versionAll = t.versionAll;
      this.dirty = true;
    }
    const size = t.cellSize;
    const vc0 = Math.floor(bounds.left / size);
    const vc1 = Math.floor(bounds.right / size);
    const vr0 = Math.floor(bounds.top / size);
    const vr1 = Math.floor(bounds.bottom / size);
    const w = this.window;
    const inside = w && vc0 >= w.c0 + 2 && vc1 <= w.c1 - 2 && vr0 >= w.r0 + 2 && vr1 <= w.r1 - 2;
    if (!inside || this.dirty) {
      this.build(vc0 - MARGIN, vc1 + MARGIN, vr0 - MARGIN, vr1 + MARGIN);
    }
    return this.shapes;
  }

  build(c0, c1, r0, r1) {
    const t = this.territory;
    c0 = Math.max(0, c0);
    r0 = Math.max(0, r0);
    c1 = Math.min(t.cols - 1, c1);
    r1 = Math.min(t.rows - 1, r1);
    this.window = { c0, c1, r0, r1 };
    this.dirty = false;
    this.shapes.clear();

    const cols = t.cols;
    const owners = t.owners;
    const present = new Set();
    for (let r = r0; r <= r1; r++) {
      for (let c = c0; c <= c1; c++) {
        const o = owners[r * cols + c];
        if (o) present.add(o);
      }
    }
    for (const slot of present) {
      // Edges against another owner's land: both sides draw the SAME curve (lower slot
      // bulges out, higher slot bulges in), so the border is round and seamless.
      const other = (c, r) => {
        const o = owners[r * cols + c];
        if (o === 0 || o === slot) return 0;
        return slot < o ? 1 : -1;
      };
      this.shapes.set(slot, traceOutline((c, r) => owners[r * cols + c] === slot, c0, c1, r0, r1, t.cellSize, other));
    }
  }
}

// Directed cell sides, clockwise on screen (y down), so the cell is always on the right:
// [start corner dc, dr], [end corner dc, dr], outward normal, neighbour offset.
const SIDES = [
  { s: [0, 0], e: [1, 0], n: [0, -1], nb: [0, -1] }, // top
  { s: [1, 0], e: [1, 1], n: [1, 0], nb: [1, 0] }, // right
  { s: [1, 1], e: [0, 1], n: [0, 1], nb: [0, 1] }, // bottom
  { s: [0, 1], e: [0, 0], n: [-1, 0], nb: [-1, 0] }, // left
];

/**
 * Outline of a set of cells inside a window: exact cell edges, each outward edge bumped
 * softly over its cell's circle (a scalloped edge that follows the floor circles).
 * @param {(c: number, r: number) => boolean} isIn cell membership (asked only inside the window)
 * @param {(c: number, r: number) => number} [isOther] neighbour belongs to someone else:
 *   1 = bulge out over it, -1 = bulge in (the neighbour bulges into us), 0 = not another owner
 * @returns {{ path: Path2D, minX: number, minY: number, maxX: number, maxY: number }}
 */
export function traceOutline(isIn, c0, c1, r0, r1, size, isOther = null) {
  const W = c1 - c0 + 3; // corner columns (with padding)
  const own = (c, r) => c >= c0 && c <= c1 && r >= r0 && r <= r1 && isIn(c, r);
  const keyOf = (c, r) => (r - r0 + 1) * W + (c - c0 + 1);

  // Every side of an owned cell that faces a non-owned cell is a directed boundary edge.
  const edges = [];
  const byStart = new Map(); // corner key -> [edge index]
  for (let r = r0; r <= r1; r++) {
    for (let c = c0; c <= c1; c++) {
      if (!own(c, r)) continue;
      for (const side of SIDES) {
        const nc = c + side.nb[0];
        const nr = r + side.nb[1];
        if (own(nc, nr)) continue;
        const sc = c + side.s[0];
        const sr = r + side.s[1];
        const edge = {
          sc, sr, ec: c + side.e[0], er: r + side.e[1],
          nx: side.n[0], ny: side.n[1],
          bulge: (isOther && nc >= c0 && nc <= c1 && nr >= r0 && nr <= r1 && isOther(nc, nr)) || 1,
          used: false,
        };
        const k = keyOf(sc, sr);
        let list = byStart.get(k);
        if (!list) { list = []; byStart.set(k, list); }
        list.push(edges.length);
        edges.push(edge);
      }
    }
  }

  const path = new Path2D();
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  const grow = (x, y) => {
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  };
  const bump = BULGE * size;

  for (let i = 0; i < edges.length; i++) {
    if (edges[i].used) continue;
    let edge = edges[i];
    path.moveTo(edge.sc * size, edge.sr * size);
    grow(edge.sc * size, edge.sr * size);
    while (edge && !edge.used) {
      edge.used = true;
      const ex = edge.ec * size;
      const ey = edge.er * size;
      const mx = (edge.sc + edge.ec) * 0.5 * size + edge.nx * bump * edge.bulge;
      const my = (edge.sr + edge.er) * 0.5 * size + edge.ny * bump * edge.bulge;
      path.quadraticCurveTo(mx, my, ex, ey);
      grow(mx, my);
      grow(ex, ey);
      // Next edge from this corner. Where two loops touch at a corner (diagonal cells),
      // turn toward the inside (right on screen) so each loop stays separate.
      const candidates = byStart.get(keyOf(edge.ec, edge.er));
      let next = null;
      let best = -Infinity;
      if (candidates) {
        const dx = edge.ec - edge.sc;
        const dy = edge.er - edge.sr;
        for (const j of candidates) {
          const e = edges[j];
          if (e.used) continue;
          const turn = dx * (e.er - e.sr) - dy * (e.ec - e.sc);
          if (turn > best) {
            best = turn;
            next = e;
          }
        }
      }
      edge = next;
    }
    path.closePath();
  }
  return { path, minX, minY, maxX, maxY };
}
