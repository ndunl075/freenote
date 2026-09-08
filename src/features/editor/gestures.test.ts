import { beforeEach, describe, expect, it } from "vitest";
import {
  clearTouches,
  hasSeenPen,
  isGesturing,
  notePointerType,
  resetPenSeen,
  shouldDraw,
  touchCount,
  touchDown,
  touchUp,
} from "./gestures";

beforeEach(() => {
  resetPenSeen();
  clearTouches();
});

const touch = (over: Partial<Parameters<typeof shouldDraw>[0]> = {}) =>
  shouldDraw({ pointerType: "touch", width: 20, height: 20, fingerDrawing: true, ...over });

describe("who is allowed to draw", () => {
  it("always lets a stylus and a mouse draw", () => {
    expect(shouldDraw({ pointerType: "pen", fingerDrawing: false })).toBe(true);
    expect(shouldDraw({ pointerType: "mouse", fingerDrawing: false })).toBe(true);
  });

  it("refuses a finger by default", () => {
    // The whole bug: a palm resting on the glass must never leave a mark, and
    // it must not depend on a stylus having been seen first — a palm lands
    // before the pen tip does.
    expect(touch({ fingerDrawing: false })).toBe(false);
  });

  it("refuses a palm-sized contact even before any stylus appears", () => {
    expect(touch({ fingerDrawing: false, width: 2, height: 2 })).toBe(false);
  });

  it("does not depend on a pen having been seen", () => {
    expect(hasSeenPen()).toBe(false);
    expect(touch({ fingerDrawing: false })).toBe(false);
    notePointerType("pen");
    expect(touch({ fingerDrawing: false })).toBe(false);
  });

  it("lets a fingertip draw once the user asks for it", () => {
    expect(touch()).toBe(true);
  });

  it("still refuses a broad contact when finger drawing is on", () => {
    expect(touch({ width: 90, height: 70 })).toBe(false);
    expect(touch({ width: 8, height: 120 })).toBe(false);
  });

  it("accepts a contact right at the fingertip limit", () => {
    expect(touch({ width: 40, height: 40 })).toBe(true);
    expect(touch({ width: 41, height: 40 })).toBe(false);
  });

  it("treats missing contact geometry as a fingertip", () => {
    // Safari reports none at all, so refusing on absence would break finger
    // drawing entirely on iOS for the people who deliberately turned it on.
    expect(shouldDraw({ pointerType: "touch", fingerDrawing: true })).toBe(true);
  });

  it("only remembers a pen, not other pointer types", () => {
    notePointerType("touch");
    notePointerType("mouse");
    expect(hasSeenPen()).toBe(false);
  });
});

describe("touch arbitration", () => {
  it("counts fingers up and down", () => {
    expect(touchDown(1)).toBe(1);
    expect(touchDown(2)).toBe(2);
    expect(touchCount()).toBe(2);
    expect(touchUp(1)).toBe(1);
    expect(touchUp(2)).toBe(0);
  });

  it("hands two fingers to the gesture layer", () => {
    touchDown(1);
    expect(isGesturing()).toBe(false);
    touchDown(2);
    expect(isGesturing()).toBe(true);
  });

  it("ignores a duplicate pointer id", () => {
    touchDown(7);
    expect(touchDown(7)).toBe(1);
  });

  it("ignores lifting a finger it never saw", () => {
    touchDown(1);
    expect(touchUp(99)).toBe(1);
  });

  it("clears every finger at once", () => {
    touchDown(1);
    touchDown(2);
    clearTouches();
    expect(touchCount()).toBe(0);
    expect(isGesturing()).toBe(false);
  });
});
