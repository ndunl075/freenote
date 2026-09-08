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
 * A stylus and a mouse always draw. A finger draws only if the user has asked
 * for it, and even then a contact too broad to be a fingertip is refused.
 *
 * This is a decision rather than an inference on purpose. The previous version
 * tried to spot a palm from its contact size and from whether a stylus had
 * been seen, and both fail on the device that matters: Safari reports no
 * contact geometry for touch, and a palm lands on the glass *before* the pen
 * tip does, so nothing has armed yet at the moment it needs to.
 */
export function shouldDraw(input: {
  pointerType: string;
  width?: number;
  height?: number;
  fingerDrawing: boolean;
}): boolean {
  if (input.pointerType !== "touch") return true;
  if (!input.fingerDrawing) return false;

  // Finger drawing is on, so a palm is still worth catching where the browser
  // gives us the geometry to catch it with.
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
