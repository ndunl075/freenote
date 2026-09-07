import type { TargetAndTransition, Variants } from "framer-motion";
import { spring } from "@/lib/motion/springs";

/** Wrong-answer shake: quick, horizontal, decaying. */
export const shake: TargetAndTransition = {
  x: [0, -10, 10, -7, 7, -3, 3, 0],
  transition: { duration: 0.42, ease: "easeInOut" },
};

/** Correct-answer pop: a small scale bump. */
export const pop: TargetAndTransition = {
  scale: [1, 1.04, 1],
  transition: { duration: 0.28, ease: "easeOut" },
};

/** Question/card swap inside a study mode. */
export const slideSwap: Variants = {
  hidden: { opacity: 0, x: 40 },
  show: { opacity: 1, x: 0, transition: spring.card },
  exit: { opacity: 0, x: -40, transition: { duration: 0.16 } },
};

/** Whole-screen mode change: cross-fade with a slight rise. */
export const screenSwap: Variants = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: spring.soft },
  exit: { opacity: 0, y: -12, transition: { duration: 0.14 } },
};

/** Staggered rows: term lists, options, tiles. */
export const rowIn: Variants = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0, transition: spring.snap },
};
