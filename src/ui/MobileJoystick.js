import { BOOST } from '../config.js';
import { clamp } from '../utils/math.js';

const BASE_RADIUS = 60;
const KNOB_RADIUS = 26;
const DEADZONE = 0.12;
const IDLE_MARGIN = 96;
const IDLE_ALPHA = 0.66;
// The minimap's footprint in the bottom-right corner (styles.css: 168px, 120px at <= 640px wide).
const MINIMAP_SIZE = 168;
const MINIMAP_SIZE_SMALL = 120;
const MINIMAP_MARGIN = 14;
const ACTIVE_ALPHA = 0.9;
const RING_COLOR = 'rgba(20, 112, 104, 0.8)';
const BASE_FILL = 'rgba(77, 251, 208, 0.1)';
const KNOB_FILL = 'rgba(19, 118, 107, 0.42)';

/**
 * Floating virtual joystick: the base appears wherever the finger lands.
 * Draws itself on the game canvas in screen space; no DOM elements.
 */
export class MobileJoystick {
  constructor() {
    this.visible = false;
    this.active = false;
    this.pointerId = null;
    this.radius = BASE_RADIUS;
    this.knobRadius = KNOB_RADIUS;
    this.baseX = 0;
    this.baseY = 0;
    this.knobX = 0;
    this.knobY = 0;
    this.idleX = IDLE_MARGIN;
    this.idleY = IDLE_MARGIN;
    this.dirX = 0;
    this.dirY = 0;
    this.magnitude = 0;
  }

  setViewport(width, height) {
    this.width = width;
    this.height = height;
    this.radius = width > height && height <= 360 ? 48 : BASE_RADIUS;
    this.knobRadius = this.radius * KNOB_RADIUS / BASE_RADIUS;
    this.idleX = Math.min(IDLE_MARGIN, width * 0.3);
    this.idleY = height - this.radius - 36;
  }

  begin(pointerId, x, y) {
    this.active = true;
    this.pointerId = pointerId;
    this.baseX = this.knobX = x;
    this.baseY = this.knobY = y;
    this.dirX = this.dirY = this.magnitude = 0;
  }

  move(x, y) {
    if (!this.active) return;
    const dx = x - this.baseX;
    const dy = y - this.baseY;
    const length = Math.hypot(dx, dy);
    const clamped = Math.min(length, this.radius);
    const nx = length > 0 ? dx / length : 0;
    const ny = length > 0 ? dy / length : 0;
    this.knobX = this.baseX + nx * clamped;
    this.knobY = this.baseY + ny * clamped;

    const raw = clamped / this.radius;
    this.magnitude = clamp((raw - DEADZONE) / (1 - DEADZONE), 0, 1);
    this.dirX = this.magnitude > 0 ? nx : 0;
    this.dirY = this.magnitude > 0 ? ny : 0;
  }

  end(pointerId) {
    if (pointerId !== this.pointerId) return;
    this.active = false;
    this.pointerId = null;
    this.dirX = this.dirY = this.magnitude = 0;
  }

  boostButton() {
    const width = this.width || window.innerWidth;
    const height = this.height || window.innerHeight;
    if (width > height) {
      // Landscape: the right thumb's spot, bottom-right just left of the minimap.
      const minimap = width <= 640 ? MINIMAP_SIZE_SMALL : MINIMAP_SIZE;
      return {
        x: width - MINIMAP_MARGIN - minimap - BOOST.BUTTON_RADIUS - 28,
        y: height - IDLE_MARGIN + 20,
        radius: BOOST.BUTTON_RADIUS,
      };
    }
    return {
      x: Math.min(this.idleX + 132, window.innerWidth - BOOST.BUTTON_RADIUS - 12),
      y: Math.max(BOOST.BUTTON_RADIUS + 12, this.idleY - 76),
      radius: BOOST.BUTTON_RADIUS,
    };
  }

  isBoostButtonAt(x, y) {
    const button = this.boostButton();
    const dx = x - button.x;
    const dy = y - button.y;
    const touchRadius = button.radius + 12;
    return dx * dx + dy * dy <= touchRadius * touchRadius;
  }

  /** Expects an identity (screen-space, CSS pixel) transform. */
  draw(ctx, boost, time) {
    if (!this.visible) return;
    const bx = this.active ? this.baseX : this.idleX;
    const by = this.active ? this.baseY : this.idleY;
    const kx = this.active ? this.knobX : bx;
    const ky = this.active ? this.knobY : by;

    ctx.globalAlpha = this.active ? ACTIVE_ALPHA : IDLE_ALPHA;
    ctx.beginPath();
    ctx.arc(bx, by, this.radius, 0, Math.PI * 2);
    ctx.fillStyle = BASE_FILL;
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = RING_COLOR;
    ctx.stroke();
    ctx.font = '700 10px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = 'rgba(205, 255, 242, 0.9)';
    ctx.fillText('MOVE', bx, by + this.radius - 17);

    ctx.beginPath();
    ctx.arc(kx, ky, this.knobRadius, 0, Math.PI * 2);
    ctx.fillStyle = KNOB_FILL;
    ctx.fill();
    ctx.globalAlpha = 1;

    this.drawBoostButton(ctx, boost, time);
  }

  drawBoostButton(ctx, boost, time) {
    const { x, y, radius } = this.boostButton();
    const active = Boolean(boost && boost.active);
    const progress = active ? clamp(boost.progress, 0, 1) : 0;
    ctx.save();
    ctx.globalAlpha = active ? 0.96 : 0.72;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(8, 16, 30, 0.78)';
    ctx.fill();
    ctx.lineWidth = active ? 4 : 1.5;
    ctx.strokeStyle = active ? 'rgba(160, 180, 210, 0.3)' : 'rgba(160, 180, 210, 0.48)';
    ctx.stroke();
    if (active && progress > 0) {
      ctx.beginPath();
      ctx.arc(x, y, radius - 2, -Math.PI / 2, -Math.PI / 2 + progress * Math.PI * 2);
      ctx.strokeStyle = '#72c9ff';
      ctx.lineWidth = 4;
      ctx.lineCap = 'round';
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.moveTo(x - 10, y + 5);
    ctx.lineTo(x - 2, y - 7);
    ctx.lineTo(x + 1, y - 1);
    ctx.lineTo(x + 9, y - 1);
    ctx.lineTo(x + 1, y + 10);
    ctx.lineTo(x - 1, y + 4);
    ctx.closePath();
    ctx.fillStyle = active ? '#b7fff0' : '#87cfff';
    ctx.globalAlpha *= active ? 1 : 0.68;
    ctx.fill();
    ctx.font = '800 8px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = active ? '#d6fff5' : '#c5d7eb';
    ctx.globalAlpha = active ? 0.95 : 0.82;
    ctx.fillText('BOOST', x, y + 24);
    ctx.restore();
  }
}
