import type { Recording, Stroke } from "@/lib/db/types";

/* ============================================================================
   Ink/audio synchronisation

   Each stroke written while recording carries `t`, its millisecond offset into
   the audio. That single number is enough to drive both directions of the
   feature: scrubbing the audio reveals ink up to that point, and tapping ink
   seeks the audio to when it was written.
   ========================================================================= */

/** Strokes that existed at time `t`. Used to replay handwriting during playback. */
export function strokesAt(strokes: Stroke[], t: number): Stroke[] {
  return strokes.filter((s) => s.t === undefined || s.t <= t);
}

/** The audio offset for a stroke, or null when it predates the recording. */
export function seekTargetFor(stroke: Stroke): number | null {
  return stroke.t ?? null;
}

/**
 * Nearest stroke written at or before `t` — what playback should highlight.
 * Strokes are stored in draw order, so a linear scan from the end finds it
 * without needing the array sorted by `t`.
 */
export function activeStrokeAt(strokes: Stroke[], t: number): Stroke | null {
  let best: Stroke | null = null;
  let bestT = -Infinity;
  for (const s of strokes) {
    if (s.t !== undefined && s.t <= t && s.t > bestT) {
      best = s;
      bestT = s.t;
    }
  }
  return best;
}

/** Marks let a scrubber show where in the audio writing actually happened. */
export function buildMarks(strokes: Stroke[]): Recording["marks"] {
  return strokes
    .filter((s): s is Stroke & { t: number } => s.t !== undefined)
    .map((s) => ({ strokeId: s.id, t: s.t }))
    .sort((a, b) => a.t - b.t);
}

/**
 * Groups marks into density buckets for the scrubber's activity histogram —
 * the visual cue for "this is the part of the lecture where I was taking
 * notes hardest".
 */
export function activityHistogram(
  marks: Recording["marks"],
  durationMs: number,
  buckets = 60,
): number[] {
  const out = new Array(buckets).fill(0);
  if (durationMs <= 0) return out;
  for (const mark of marks) {
    const i = Math.min(buckets - 1, Math.floor((mark.t / durationMs) * buckets));
    if (i >= 0) out[i]++;
  }
  const peak = Math.max(1, ...out);
  return out.map((n) => n / peak);
}
