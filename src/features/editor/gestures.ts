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

/* --- Palm rejection --------------------------------------------------------
   Once a stylus has touched the screen, every touch that follows is a hand
   resting on the page, not someone choosing to draw with a finger. Waiting for
   a setting to be switched on is the wrong default: by the time you notice
   your palm is drawing, it has already drawn.

   A contact patch also gives it away before any pen appears. A stylus tip
   reports a couple of pixels, a fingertip twenty or thirty, and a palm far
   more — so an unusually broad contact is rejected on its own evidence. */

let penSeen = false;

/** Widest contact, in CSS px, still plausibly a deliberate fingertip. */
const MAX_FINGER_CONTACT = 40;

export function notePointerType(pointerType: string): void {
  if (pointerType === "pen") penSeen = true;
}

export function hasSeenPen(): boolean {
  return penSeen;
}

/** Test seam — a page reload is otherwise the only way to clear this. */
export function resetPenSeen(): void {
  penSeen = false;
}

/**
 * Should this pointer be allowed to lay down ink?
 *
 * `forcePenOnly` is the user's explicit setting; the rest is inference.
 */
export function shouldDraw(input: {
  pointerType: string;
  width?: number;
  height?: number;
  forcePenOnly: boolean;
}): boolean {
  if (input.pointerType === "pen" || input.pointerType === "mouse") return true;
  if (input.pointerType !== "touch") return true;

  if (input.forcePenOnly) return false;
  // A stylus has been used, so this touch is a resting hand.
  if (penSeen) return false;

  // No pen yet: judge the contact on its size.
  const w = input.width ?? 0;
  const h = input.height ?? 0;
  return Math.max(w, h) <= MAX_FINGER_CONTACT;
}


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
