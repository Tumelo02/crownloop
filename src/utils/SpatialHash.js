import { clamp } from './math.js';

/**
 * Uniform grid for fast neighbourhood queries on point-like items ({ x, y }).
 * Incremental: items remember their bucket (`item.hashCell`), so a large, mostly
 * static population (food across a huge world) never needs a per-frame rebuild.
 */
export class SpatialHash {
  constructor(width, height, cellSize) {
    this.cellSize = cellSize;
    this.cols = Math.ceil(width / cellSize);
    this.rows = Math.ceil(height / cellSize);
    this.buckets = Array.from({ length: this.cols * this.rows }, () => []);
  }

  clear() {
    for (const bucket of this.buckets) {
      for (const item of bucket) item.hashCell = -1;
      bucket.length = 0;
    }
  }

  cellFor(x, y) {
    const col = clamp(Math.floor(x / this.cellSize), 0, this.cols - 1);
    const row = clamp(Math.floor(y / this.cellSize), 0, this.rows - 1);
    return row * this.cols + col;
  }

  insert(item) {
    const cell = this.cellFor(item.x, item.y);
    item.hashCell = cell;
    this.buckets[cell].push(item);
  }

  remove(item) {
    if (item.hashCell === undefined || item.hashCell < 0) return;
    const bucket = this.buckets[item.hashCell];
    const index = bucket.indexOf(item);
    if (index >= 0) {
      bucket[index] = bucket[bucket.length - 1];
      bucket.pop();
    }
    item.hashCell = -1;
  }

  /** Call after changing an item's position. */
  move(item) {
    const cell = this.cellFor(item.x, item.y);
    if (cell === item.hashCell) return;
    this.remove(item);
    item.hashCell = cell;
    this.buckets[cell].push(item);
  }

  /** Fills `out` with items in cells overlapping the query circle's bounding box. */
  query(x, y, radius, out) {
    return this.queryRect(x - radius, y - radius, x + radius, y + radius, out);
  }

  queryRect(left, top, right, bottom, out) {
    out.length = 0;
    const size = this.cellSize;
    const c0 = clamp(Math.floor(left / size), 0, this.cols - 1);
    const c1 = clamp(Math.floor(right / size), 0, this.cols - 1);
    const r0 = clamp(Math.floor(top / size), 0, this.rows - 1);
    const r1 = clamp(Math.floor(bottom / size), 0, this.rows - 1);
    for (let row = r0; row <= r1; row++) {
      const base = row * this.cols;
      for (let col = c0; col <= c1; col++) {
        const bucket = this.buckets[base + col];
        for (let i = 0; i < bucket.length; i++) out.push(bucket[i]);
      }
    }
    return out;
  }
}
