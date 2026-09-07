/**
 * Deterministic randomness for the study engines.
 *
 * Every engine takes an `Rng` so a round, exam, or tile grid can be replayed
 * exactly in a test. Production callers pass `Math.random` (the default).
 */

export type Rng = () => number;

/** mulberry32 — small, fast, good enough for shuffling flashcards. */
export function createRng(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Pull a fresh 31-bit seed out of an rng so a pure reducer can carry it in state. */
export function nextSeed(rng: Rng): number {
  return Math.floor(rng() * 0x7fffffff);
}

/** djb2 string hash — lets a set id seed a stable shuffle. */
export function seedFrom(text: string): number {
  let h = 5381;
  for (let i = 0; i < text.length; i++) h = ((h << 5) + h + text.charCodeAt(i)) >>> 0;
  return h;
}

/** Fisher–Yates on a copy. */
export function shuffle<T>(items: readonly T[], rng: Rng = Math.random): T[] {
  const out = items.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = out[i];
    out[i] = out[j];
    out[j] = tmp;
  }
  return out;
}

export function sample<T>(items: readonly T[], count: number, rng: Rng = Math.random): T[] {
  return shuffle(items, rng).slice(0, Math.max(0, count));
}

export function pick<T>(items: readonly T[], rng: Rng = Math.random): T | undefined {
  if (!items.length) return undefined;
  return items[Math.floor(rng() * items.length)];
}
