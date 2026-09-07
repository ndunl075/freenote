"use client";

import { animate, motion, useMotionValue, useReducedMotion, useTransform } from "framer-motion";
import { Check, X } from "lucide-react";
import { forwardRef, useImperativeHandle, useRef, type ReactNode } from "react";
import type { Pile } from "@/lib/study/flashcards";
import { spring } from "@/lib/motion/springs";
import { FlipCard, type FlipCardProps } from "./FlipCard";

export interface SwipeCardHandle {
  /** Animate the card off-screen and file it. Used by buttons and arrow keys. */
  fling: (pile: Pile) => void;
}

const THRESHOLD = 110;
const VELOCITY = 600;

/**
 * Drag-to-sort wrapper around the flip card. Dragging right tints mint and
 * files the card as "Know"; left tints coral for "Still learning". The
 * card rotates with the drag and flies off when released past the threshold.
 */
export const SwipeCard = forwardRef<
  SwipeCardHandle,
  FlipCardProps & { sortable: boolean; onSort: (pile: Pile) => void; children?: ReactNode }
>(function SwipeCard({ sortable, onSort, ...card }, ref) {
  const reduce = useReducedMotion();
  const x = useMotionValue(0);
  const rotate = useTransform(x, [-360, 0, 360], [-14, 0, 14]);
  const knowOpacity = useTransform(x, [0, 60, 200], [0, 0.35, 1]);
  const learnOpacity = useTransform(x, [-200, -60, 0], [1, 0.35, 0]);
  const knowTint = useTransform(x, [0, 200], [0, 0.16]);
  const learnTint = useTransform(x, [-200, 0], [0.16, 0]);
  const flying = useRef(false);
  // A drag release still produces a click on the card; don't let it flip.
  const dragging = useRef(false);

  const fling = (pile: Pile) => {
    if (flying.current) return;
    flying.current = true;
    const width = typeof window === "undefined" ? 1200 : window.innerWidth;
    const target = (pile === "know" ? 1 : -1) * Math.max(700, width * 0.9);
    // The parent swaps in the next card (a fresh instance) on sort, so this
    // instance can stay off-screen while it fades out.
    const done = () => {
      onSort(pile);
      flying.current = false;
    };
    if (reduce) {
      done();
      return;
    }
    animate(x, target, { ...spring.toss, restDelta: 4 }).then(done);
  };

  useImperativeHandle(ref, () => ({ fling }));

  return (
    <motion.div
      drag={sortable && !reduce ? "x" : false}
      dragElastic={0.85}
      dragMomentum={false}
      style={{ x, rotate }}
      onDragStart={() => {
        dragging.current = true;
      }}
      onDragEnd={(_, info) => {
        window.setTimeout(() => {
          dragging.current = false;
        }, 0);
        const { offset, velocity } = info;
        if (offset.x > THRESHOLD || velocity.x > VELOCITY) fling("know");
        else if (offset.x < -THRESHOLD || velocity.x < -VELOCITY) fling("learning");
        else animate(x, 0, spring.snap);
      }}
      className="relative h-full w-full touch-pan-y"
    >
      <FlipCard
        {...card}
        onFlip={() => {
          if (!dragging.current) card.onFlip();
        }}
      />

      {sortable && (
        <>
          <motion.div
            aria-hidden
            style={{ opacity: knowTint }}
            className="pointer-events-none absolute inset-0 rounded-[16px] bg-[var(--correct)]"
          />
          <motion.div
            aria-hidden
            style={{ opacity: learnTint }}
            className="pointer-events-none absolute inset-0 rounded-[16px] bg-[var(--incorrect)]"
          />
          <motion.span
            aria-hidden
            style={{ opacity: knowOpacity }}
            className="pointer-events-none absolute left-5 top-14 inline-flex h-14 w-14 items-center justify-center rounded-full border-4 border-[var(--correct)] text-[var(--correct)]"
          >
            <Check className="h-8 w-8" strokeWidth={3} />
          </motion.span>
          <motion.span
            aria-hidden
            style={{ opacity: learnOpacity }}
            className="pointer-events-none absolute right-5 top-14 inline-flex h-14 w-14 items-center justify-center rounded-full border-4 border-[var(--incorrect)] text-[var(--incorrect)]"
          >
            <X className="h-8 w-8" strokeWidth={3} />
          </motion.span>
        </>
      )}
    </motion.div>
  );
});
