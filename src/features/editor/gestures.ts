"use client";

/* ============================================================================
   Touch arbitration between the canvas and the page.

   Two components want the same touches: the canvas wants to draw with them,
   the scroller wants to pan and pinch with them. Rather than have either guess,
   they share one count of how many fingers are down.

   The rule is simple and matches what tablets have taught people to expect:
   one finger draws, two fingers move the page. A second finger arriving
   cancels whatever the first was drawing, so a pinch never leaves a stray
   mark behind.
   ========================================================================= */

const active = new Set<number>();

export function touchDown(pointerId: number): number {
  active.add(pointerId);
  return active.size;
}

export function touchUp(pointerId: number): number {
  active.delete(pointerId);
  return active.size;
}

export function touchCount(): number {
  return active.size;
}

export function clearTouches(): void {
  active.clear();
}

/** True when the gesture layer, not the canvas, owns the current touches. */
export function isGesturing(): boolean {
  return active.size >= 2;
}
