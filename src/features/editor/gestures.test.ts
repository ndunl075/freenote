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
  shouldDraw({ pointerType: "touch", width: 20, height: 20, forcePenOnly: false, ...over });

describe("palm rejection", () => {
  it("always lets a stylus and a mouse draw", () => {
    expect(shouldDraw({ pointerType: "pen", forcePenOnly: true })).toBe(true);
    expect(shouldDraw({ pointerType: "mouse", forcePenOnly: true })).toBe(true);
  });

  it("lets a fingertip draw before any stylus has appeared", () => {
    expect(touch()).toBe(true);
  });

  it("stops touch drawing for good once a stylus has been used", () => {
    expect(touch()).toBe(true);
    notePointerType("pen");
    expect(hasSeenPen()).toBe(true);
    // This is the bug people actually hit: a palm resting beside the pen.
    expect(touch()).toBe(false);
  });

  it("rejects a broad contact patch even before a stylus appears", () => {
    // A stylus tip is a couple of px, a fingertip twenty or thirty, a palm far
    // more. Judge it on its own evidence rather than waiting for a setting.
    expect(touch({ width: 90, height: 70 })).toBe(false);
    expect(touch({ width: 8, height: 120 })).toBe(false);
  });

  it("accepts a contact right at the fingertip limit", () => {
    expect(touch({ width: 40, height: 40 })).toBe(true);
    expect(touch({ width: 41, height: 40 })).toBe(false);
  });

  it("honours the explicit pen-only setting with no stylus in sight", () => {
    expect(touch({ forcePenOnly: true })).toBe(false);
  });

  it("treats missing contact geometry as a fingertip", () => {
    // Some browsers report nothing; refusing to draw would be worse than
    // occasionally accepting a touch.
    expect(shouldDraw({ pointerType: "touch", forcePenOnly: false })).toBe(true);
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
