import type { Transition, Variants } from "framer-motion";

/**
 * Shared motion vocabulary. Motion here is spring-driven and restrained, and
 * above all quick: an animation you notice waiting for is too slow. Opening or
 * deleting a note should feel like the app already knew — the movement exists
 * to show what moved where, not to be admired.
 */

export const spring = {
  /** Default for anything that moves position or scale. */
  soft: { type: "spring", stiffness: 460, damping: 36, mass: 0.7 },
  /** List items appearing and disappearing. Effectively immediate. */
  instant: { type: "spring", stiffness: 900, damping: 48, mass: 0.5 },
  /** Card flips, mode transitions. */
  card: { type: "spring", stiffness: 340, damping: 30, mass: 0.85 },
  /** Snappy, near-critically-damped: toggles, chips, small controls. */
  snap: { type: "spring", stiffness: 700, damping: 40, mass: 0.6 },
  /** Sheets and drawers. */
  sheet: { type: "spring", stiffness: 520, damping: 42, mass: 0.8 },
  /** Physical throw for swipeable flashcards. */
  toss: { type: "spring", stiffness: 200, damping: 26, mass: 1.1 },
} satisfies Record<string, Transition>;

export const ease = {
  standard: [0.4, 0, 0.2, 1],
  out: [0, 0, 0.2, 1],
  in: [0.4, 0, 1, 1],
} as const;

export const duration = {
  fast: 0.09,
  normal: 0.14,
  slow: 0.22,
} as const;

/** Fade + rise, the workhorse entrance. */
export const riseIn: Variants = {
  hidden: { opacity: 0, y: 8 },
  show: { opacity: 1, y: 0, transition: spring.instant },
  exit: { opacity: 0, y: -6, transition: { duration: duration.fast } },
};

/**
 * Stagger container for grids and lists.
 *
 * The step is deliberately tiny. A stagger's job is to stop a dozen cards
 * arriving as one indistinguishable block; past about 20ms it starts reading
 * as the interface making you wait your turn.
 */
export const stagger = (step = 0.018, delay = 0): Variants => ({
  hidden: {},
  show: { transition: { staggerChildren: step, delayChildren: delay } },
});

export const scaleIn: Variants = {
  hidden: { opacity: 0, scale: 0.97 },
  show: { opacity: 1, scale: 1, transition: spring.snap },
  exit: { opacity: 0, scale: 0.98, transition: { duration: duration.fast } },
};

export const overlayFade: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { duration: duration.normal } },
  exit: { opacity: 0, transition: { duration: duration.fast } },
};
