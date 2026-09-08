/* ============================================================================
   One Euro filter.

   Digitisers are noisy. A stylus resting still still reports a point that
   jitters by a pixel or two, and that jitter is what turns a line you drew
   straight into one that wobbles.

   The naive fixes both fail. Smooth everything hard and the ink lags visibly
   behind the nib. Smooth nothing and it shakes. The One Euro filter (Casiez,
   Roussel & Vogel, CHI 2012) resolves that by varying its own cutoff with
   speed: heavy smoothing while the pen is slow, where jitter is visible and
   lag is not, and almost none while it is fast, where the reverse is true.

   That is why this exists rather than another hand-tuned smoothing constant —
   the correct amount of smoothing is not a constant.
   ========================================================================= */

class LowPass {
  private hatPrev: number | null = null;

  filter(value: number, alpha: number): number {
    const hat = this.hatPrev === null ? value : alpha * value + (1 - alpha) * this.hatPrev;
    this.hatPrev = hat;
    return hat;
  }

  reset(): void {
    this.hatPrev = null;
  }

  get hasValue(): boolean {
    return this.hatPrev !== null;
  }
}

function alphaFor(cutoff: number, dt: number): number {
  const tau = 1 / (2 * Math.PI * cutoff);
  return 1 / (1 + tau / dt);
}

export interface OneEuroOptions {
  /** Cutoff at rest, in Hz. Lower is smoother and laggier. */
  minCutoff?: number;
  /** How sharply the cutoff opens up with speed. Higher tracks faster. */
  beta?: number;
  /** Cutoff for the speed estimate itself. */
  derivativeCutoff?: number;
}

export class OneEuroFilter {
  private readonly minCutoff: number;
  private readonly beta: number;
  private readonly dCutoff: number;
  private readonly value = new LowPass();
  private readonly derivative = new LowPass();
  private previous: number | null = null;

  constructor({ minCutoff = 1, beta = 0.007, derivativeCutoff = 1 }: OneEuroOptions = {}) {
    this.minCutoff = minCutoff;
    this.beta = beta;
    this.dCutoff = derivativeCutoff;
  }

  /** @param dt seconds since the previous sample. */
  filter(value: number, dt: number): number {
    // A non-positive dt would divide by zero and blow the filter up; pointer
    // streams do occasionally deliver two samples on the same timestamp.
    const step = dt > 0 ? dt : 1 / 120;

    const rate = this.previous === null ? 0 : (value - this.previous) / step;
    this.previous = value;

    const edot = this.derivative.filter(rate, alphaFor(this.dCutoff, step));
    const cutoff = this.minCutoff + this.beta * Math.abs(edot);
    return this.value.filter(value, alphaFor(cutoff, step));
  }

  reset(): void {
    this.value.reset();
    this.derivative.reset();
    this.previous = null;
  }
}

/** Two One Euro filters, one per axis, sharing a tuning. */
export class PointFilter {
  private readonly x: OneEuroFilter;
  private readonly y: OneEuroFilter;

  constructor(options?: OneEuroOptions) {
    this.x = new OneEuroFilter(options);
    this.y = new OneEuroFilter(options);
  }

  filter(x: number, y: number, dt: number): [number, number] {
    return [this.x.filter(x, dt), this.y.filter(y, dt)];
  }

  reset(): void {
    this.x.reset();
    this.y.reset();
  }
}

/**
 * Tunings per input device.
 *
 * A stylus reports fine detail worth keeping, so it gets a high cutoff and
 * only light smoothing. A finger is blunt and shaky and benefits from much
 * more. A mouse has no tremor at all but moves in visible jumps between
 * samples, so it wants smoothing without the speed adaptation fighting it.
 */
export function filterFor(pointerType: string): PointFilter {
  switch (pointerType) {
    case "pen":
      return new PointFilter({ minCutoff: 2.4, beta: 0.012, derivativeCutoff: 1.2 });
    case "touch":
      return new PointFilter({ minCutoff: 1.1, beta: 0.006, derivativeCutoff: 1 });
    default:
      return new PointFilter({ minCutoff: 1.8, beta: 0.02, derivativeCutoff: 1 });
  }
}
