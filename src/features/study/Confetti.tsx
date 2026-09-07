"use client";

import { motion, useReducedMotion } from "framer-motion";
import { useMemo } from "react";
import { createRng } from "@/lib/study/random";

const COLORS = ["var(--brand)", "var(--correct)", "var(--star)", "var(--incorrect)"];

/**
 * A one-shot burst for "new record" and "all mastered" moments. Pure DOM +
 * springs, no canvas; skipped entirely under reduced motion.
 */
export function Confetti({ count = 28, seed = 7 }: { count?: number; seed?: number }) {
  const reduce = useReducedMotion();
  const pieces = useMemo(() => {
    const rng = createRng(seed);
    return Array.from({ length: count }, (_, i) => {
      const angle = (i / count) * Math.PI * 2 + rng() * 0.4;
      const distance = 120 + rng() * 160;
      return {
        id: i,
        x: Math.cos(angle) * distance,
        y: Math.sin(angle) * distance - 80,
        rotate: rng() * 540 - 270,
        color: COLORS[i % COLORS.length],
        w: 6 + rng() * 6,
        h: 8 + rng() * 10,
        delay: rng() * 0.08,
      };
    });
  }, [count, seed]);

  if (reduce) return null;

  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-visible">
      {pieces.map((p) => (
        <motion.span
          key={p.id}
          initial={{ x: 0, y: 0, opacity: 1, rotate: 0, scale: 0.6 }}
          animate={{ x: p.x, y: p.y + 120, opacity: 0, rotate: p.rotate, scale: 1 }}
          transition={{ duration: 1.3, delay: p.delay, ease: [0.2, 0.8, 0.3, 1] }}
          style={{
            position: "absolute",
            left: "50%",
            top: "40%",
            width: p.w,
            height: p.h,
            borderRadius: 2,
            background: p.color,
          }}
        />
      ))}
    </div>
  );
}
