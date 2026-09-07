import { describe, expect, it } from "vitest";
import type { Progress } from "@/lib/db";
import {
  BOX_INTERVALS_MS,
  demote,
  isDue,
  isMastered,
  MASTERED_BOX,
  masteryOf,
  MAX_BOX,
  orderForStudy,
  pickNext,
  promote,
  summarize,
} from "./scheduler";

const p = (termId: string, patch: Partial<Progress> = {}): Progress => ({
  termId,
  setId: "set",
  box: 0,
  streak: 0,
  lapses: 0,
  seen: 0,
  correct: 0,
  dueAt: 0,
  lastSeenAt: 0,
  writtenCorrect: 0,
  choiceCorrect: 0,
  ...patch,
});

const NOW = 1_000_000;

describe("promote", () => {
  it("moves up one box, extends streak and schedules the next review", () => {
    const next = promote(p("a"), NOW);
    expect(next.box).toBe(1);
    expect(next.streak).toBe(1);
    expect(next.seen).toBe(1);
    expect(next.correct).toBe(1);
    expect(next.dueAt).toBe(NOW + BOX_INTERVALS_MS[1]);
    expect(next.lastSeenAt).toBe(NOW);
  });

  it("can jump several boxes but never past the top", () => {
    expect(promote(p("a", { box: 1 }), NOW, 3).box).toBe(4);
    expect(promote(p("a", { box: 4 }), NOW, 3).box).toBe(MAX_BOX);
    expect(promote(p("a", { box: 5 }), NOW).box).toBe(MAX_BOX);
  });

  it("does not mutate its input", () => {
    const before = p("a");
    promote(before, NOW);
    expect(before.box).toBe(0);
  });
});

describe("demote", () => {
  it("drops to box 1 from anywhere above it and resets the streak", () => {
    const next = demote(p("a", { box: 5, streak: 4 }), NOW);
    expect(next.box).toBe(1);
    expect(next.streak).toBe(0);
    expect(next.lapses).toBe(1);
    expect(next.seen).toBe(1);
    expect(next.dueAt).toBe(NOW);
  });

  it("stays at zero from box 0 or 1", () => {
    expect(demote(p("a", { box: 1 }), NOW).box).toBe(0);
    expect(demote(p("a", { box: 0 }), NOW).box).toBe(0);
  });
});

describe("isDue / isMastered / masteryOf", () => {
  it("is due when dueAt has passed", () => {
    expect(isDue(p("a", { dueAt: NOW }), NOW)).toBe(true);
    expect(isDue(p("a", { dueAt: NOW + 1 }), NOW)).toBe(false);
  });

  it("classifies mastery", () => {
    expect(masteryOf(p("a"))).toBe("not-started");
    expect(masteryOf(p("a", { seen: 1 }))).toBe("learning");
    expect(masteryOf(p("a", { box: 2 }))).toBe("learning");
    expect(masteryOf(p("a", { box: MASTERED_BOX }))).toBe("mastered");
    expect(isMastered(p("a", { box: MASTERED_BOX }))).toBe(true);
  });
});

describe("pickNext / orderForStudy", () => {
  it("prefers due terms, then lower boxes, then least recently seen", () => {
    const list = [
      p("notDueLow", { box: 1, dueAt: NOW + 1000 }),
      p("dueHigh", { box: 3, dueAt: NOW - 1, lastSeenAt: 10 }),
      p("dueLowRecent", { box: 1, dueAt: NOW - 1, lastSeenAt: 50 }),
      p("dueLowOld", { box: 1, dueAt: NOW - 1, lastSeenAt: 5 }),
    ];
    expect(orderForStudy(list, NOW).map((x) => x.termId)).toEqual([
      "dueLowOld",
      "dueLowRecent",
      "dueHigh",
      "notDueLow",
    ]);
    expect(pickNext(list, NOW)?.termId).toBe("dueLowOld");
  });

  it("skips mastered terms unless asked", () => {
    const list = [p("done", { box: 5 }), p("todo", { box: 2 })];
    expect(pickNext(list, NOW)?.termId).toBe("todo");
    expect(orderForStudy(list, NOW, { includeMastered: true })).toHaveLength(2);
  });

  it("honours exclusions but falls back rather than returning nothing", () => {
    const list = [p("a"), p("b")];
    expect(pickNext(list, NOW, { exclude: ["a"] })?.termId).toBe("b");
    expect(pickNext([p("a")], NOW, { exclude: ["a"] })?.termId).toBe("a");
  });

  it("returns null with nothing to study", () => {
    expect(pickNext([], NOW)).toBeNull();
    expect(pickNext([p("done", { box: 5 })], NOW)).toBeNull();
  });
});

describe("summarize", () => {
  it("counts mastery buckets", () => {
    expect(summarize([p("a"), p("b", { seen: 1 }), p("c", { box: 3 }), p("d", { box: 5 })])).toEqual({
      total: 4,
      notStarted: 1,
      learning: 2,
      mastered: 1,
    });
  });
});
