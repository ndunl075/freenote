import type { Transition, Variants } from "framer-motion";

/**
 * Shared motion vocabulary. Motion here is spring-driven and restrained, the
 * way system UI moves: cards settle in ~350ms, overlays in ~200ms, and nothing
 * bounces hard enough to read as playful for its own sake.
 */

export const spring = {
  /** Default for anything that moves position or scale. */
  soft: { type: "spring", stiffness: 320, damping: 32, mass: 0.9 },
  /** Card flips, mode transitions. */
  card: { type: "spring", stiffness: 260, damping: 28, mass: 1 },
  /** Snappy, near-critically-damped: toggles, chips, small controls. */
  snap: { type: "spring", stiffness: 520, damping: 38, mass: 0.7 },
  /** Sheets and drawers. */
  sheet: { type: "spring", stiffness: 380, damping: 40, mass: 1 },
  /** Physical throw for swipeable flashcards. */
  toss: { type: "spring", stiffness: 200, damping: 26, mass: 1.1 },
} satisfies Record<string, Transition>;

export const ease = {
  standard: [0.4, 0, 0.2, 1],
  out: [0, 0, 0.2, 1],
  in: [0.4, 0, 1, 1],
} as const;

export const duration = {
  fast: 0.15,
  normal: 0.22,
  slow: 0.35,
} as const;

/** Fade + rise, the workhorse entrance. */
export const riseIn: Variants = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: spring.soft },
  exit: { opacity: 0, y: -8, transition: { duration: duration.fast } },
};

/** Stagger container for grids and lists. */
export const stagger = (step = 0.04, delay = 0): Variants => ({
  hidden: {},
  show: { transition: { staggerChildren: step, delayChildren: delay } },
});

export const scaleIn: Variants = {
  hidden: { opacity: 0, scale: 0.96 },
  show: { opacity: 1, scale: 1, transition: spring.snap },
  exit: { opacity: 0, scale: 0.98, transition: { duration: duration.fast } },
};

export const overlayFade: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { duration: duration.normal } },
  exit: { opacity: 0, transition: { duration: duration.fast } },
};
