/* ============================================================================
   Nib dynamics.

   The width of a real pen stroke is not one number. It varies with how hard
   you press, how fast you move, and — for a pencil — how far you tilt it. A
   stroke drawn at a constant width reads as a tube, which is what made the
   ink here feel lifeless.

   This turns raw pointer data into a per-point "nib pressure" in 0..1 that
   perfect-freehand then maps to width. It is a pure function so it can be
   tested without a canvas, a pointer, or a browser.
   ========================================================================= */

export interface NibSample {
  /** Reported pointer pressure, 0..1. Mice and most touch report 0 or 0.5. */
  pressure: number;
  /** True once the device has proven it reports real, varying pressure. */
  hasPressure: boolean;
  /** Speed in CSS px per millisecond. */
  speed: number;
  /** Tilt from vertical in degrees, 0 = upright. Apple Pencil reports this. */
  tilt: number;
}

/** Above this speed a stroke is at its thinnest. ~1.6px/ms is a brisk flick. */
const FAST = 1.6;
/** Below this it is at its thickest — a deliberate, slow line. */
const SLOW = 0.15;

/** How much of the width a stylus hands over to speed rather than pressure. */
const SPEED_INFLUENCE = 0.25;

export function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

/**
 * Speed → thickness, inverted and eased.
 *
 * Fast strokes are thin, slow strokes are thick, which is how ink behaves when
 * a nib has less dwell time to deposit. The curve is eased rather than linear
 * so that ordinary handwriting speeds sit in the expressive middle of the
 * range instead of pinning to one end.
 */
export function speedToWidth(speed: number): number {
  const t = clamp01((speed - SLOW) / (FAST - SLOW));
  // Smoothstep, then invert: slow → 1 (thick), fast → 0 (thin).
  return 1 - t * t * (3 - 2 * t);
}

/**
 * Tilt → breadth. A pencil laid over on its side lays down a broader mark, so
 * past about 30° we start widening. Below that it is upright enough not to
 * matter, and treating small tilts as shading makes normal writing wobble.
 */
export function tiltToBreadth(tiltDegrees: number): number {
  const t = clamp01((Math.abs(tiltDegrees) - 30) / 50);
  return t * t;
}

/**
 * The per-point value handed to the stroke outliner.
 *
 * With a real stylus, pressure leads and speed only trims the edges — the
 * whole point of a pressure-sensitive pen is that pressing harder is what
 * makes a heavier line. Without pressure data, speed becomes the entire
 * signal, which is what stops mouse and finger strokes reading as flat tubes.
 */
export function nibPressure({ pressure, hasPressure, speed, tilt }: NibSample): number {
  const fromSpeed = speedToWidth(speed);

  const base = hasPressure
    ? clamp01(pressure) * (1 - SPEED_INFLUENCE) + fromSpeed * SPEED_INFLUENCE
    : fromSpeed;

  // Tilt only ever adds breadth; it should never thin a stroke.
  return clamp01(base + tiltToBreadth(tilt) * (1 - base) * 0.6);
}

/** Tilt from vertical, in degrees, from the tiltX/tiltY a PointerEvent gives. */
export function tiltFromEvent(tiltX: number, tiltY: number): number {
  if (!tiltX && !tiltY) return 0;
  // Each axis is already an angle from vertical; combine them as a vector.
  return Math.min(90, Math.hypot(tiltX, tiltY));
}
