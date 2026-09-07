"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Heart } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Settings as AppSettings, StudySet, Term } from "@/lib/db";
import {
  answerBlast,
  BLAST_LIVES,
  createBlastState,
  startBlast,
  tickBlast,
  type BlastPop,
  type BlastState,
  type BlastTile,
} from "@/lib/study/blast";
import { seedFrom } from "@/lib/study/random";
import { Button } from "@/components/ui";
import { riseIn, spring, stagger } from "@/lib/motion/springs";
import { cn } from "@/lib/utils/cn";
import { modeMeta } from "../modes";
import { shake } from "../motion";
import { routes } from "../routes";
import { NavButton } from "../NavButton";
import { StudyHeader, StudyScreen } from "../StudyHeader";

export interface BlastProps {
  set: StudySet;
  terms: Term[];
  settings: AppSettings;
}

const clockNow = () => performance.now();
const FLASH_MS = 450;

export function Blast({ set, terms, settings }: BlastProps) {
  const reduce = useReducedMotion();
  const [state, setState] = useState<BlastState>(() =>
    createBlastState(terms, { seed: seedFrom(set.id) ^ (Date.now() & 0xffff) }),
  );
  const [input, setInput] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const meta = modeMeta("blast");

  /* The input flashes mint/coral for a beat after each submission; the
   * simulation clock advances every frame, so this needs no timer. */
  const flash: "hit" | "miss" | null =
    state.lastAnswer && state.lastTick - state.lastAnswer.at < FLASH_MS
      ? state.lastAnswer.hit
        ? "hit"
        : "miss"
      : null;

  const start = useCallback(() => {
    setState((s) => startBlast({ ...s, seed: s.seed ^ Date.now() }, clockNow()));
    setInput("");
    window.setTimeout(() => inputRef.current?.focus(), 0);
  }, []);

  /* Simulation loop. */
  useEffect(() => {
    if (state.status !== "playing") return;
    let frame = 0;
    const loop = () => {
      setState((s) => tickBlast(s, clockNow()));
      frame = requestAnimationFrame(loop);
    };
    frame = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frame);
  }, [state.status]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;
    setState((s) => answerBlast(s, input, clockNow(), settings.gradingStrictness));
    setInput("");
  };

  const playing = state.status === "playing";

  return (
    <StudyScreen>
      <StudyHeader
        mode="blast"
        setId={set.id}
        title={set.title}
        center={
          playing ? (
            <div className="flex items-center gap-4 text-[15px] font-bold">
              <span className="tabular-nums">
                <span className="text-[var(--text-muted)]">Score </span>
                {state.score}
              </span>
              <span className="text-[var(--text-muted)]">Level {state.level}</span>
              <Lives lives={state.lives} />
            </div>
          ) : undefined
        }
      />

      <main className="mx-auto flex w-full max-w-[1000px] flex-1 flex-col px-3 pb-4 md:px-6">
        <AnimatePresence mode="wait" initial={false}>
          {state.status === "idle" && (
            <motion.section
              key="intro"
              variants={stagger(0.06)}
              initial="hidden"
              animate="show"
              exit={{ opacity: 0, transition: { duration: 0.12 } }}
              className="mx-auto flex max-w-[520px] flex-1 flex-col items-center justify-center py-12 text-center"
            >
              <motion.span variants={riseIn} className="inline-flex h-20 w-20 items-center justify-center rounded-[20px] bg-[var(--brand-soft)] text-[var(--brand)]">
                <meta.Icon className="h-10 w-10" aria-hidden />
              </motion.span>
              <motion.h2 variants={riseIn} className="mt-6 text-[32px] leading-tight md:text-[40px]">
                Blast
              </motion.h2>
              <motion.p variants={riseIn} className="mt-3 text-[16px] text-[var(--text-muted)]">
                Definitions fall from the top. Type the matching term and press Enter to blast them before they hit the
                ground. You have {BLAST_LIVES} lives — every five hits speeds things up.
              </motion.p>
              <motion.div variants={riseIn} className="mt-8">
                <Button size="lg" onClick={start} autoFocus disabled={!state.terms.length}>
                  Start game
                </Button>
              </motion.div>
            </motion.section>
          )}

          {playing && (
            <motion.div
              key="field"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0, transition: { duration: 0.15 } }}
              className="flex flex-1 flex-col"
            >
              <div
                className="relative mt-3 flex-1 overflow-hidden rounded-[16px] border border-[var(--border-soft)] bg-[var(--surface-2)]"
                style={{ minHeight: "min(62vh, 560px)" }}
                aria-live="off"
              >
                {state.tiles.map((tile) => (
                  <Falling key={tile.id} tile={tile} />
                ))}
                {state.popped.map((p) => (
                  <Pop key={p.id} pop={p} reduce={!!reduce} />
                ))}
                <div aria-hidden className="absolute inset-x-0 bottom-0 h-1.5 bg-[var(--incorrect)] opacity-60" />
                <div className="pointer-events-none absolute right-3 top-3 rounded-full bg-[var(--surface)] px-3 py-1 text-[12px] font-bold text-[var(--text-muted)] shadow-[var(--shadow-sm)]">
                  Streak {state.streak}
                </div>
              </div>

              <form onSubmit={submit} className="mt-3">
                <label htmlFor="blast-input" className="sr-only">
                  Type the term
                </label>
                <motion.input
                  ref={inputRef}
                  id="blast-input"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Type the term and press Enter"
                  autoComplete="off"
                  autoCapitalize="off"
                  spellCheck={false}
                  autoFocus
                  animate={flash === "miss" && !reduce ? shake : { x: 0 }}
                  className={cn(
                    "h-14 w-full rounded-[12px] border-2 bg-[var(--surface)] px-4 text-[18px] text-[var(--text)] outline-none",
                    "transition-colors placeholder:text-[var(--text-faint)]",
                    flash === "hit"
                      ? "border-[var(--correct)] bg-[var(--correct-bg)]"
                      : flash === "miss"
                        ? "border-[var(--incorrect)] bg-[var(--incorrect-bg)]"
                        : "border-[var(--border)] focus:border-[var(--brand)]",
                  )}
                />
              </form>
            </motion.div>
          )}

          {state.status === "over" && (
            <motion.section
              key="over"
              variants={stagger(0.06)}
              initial="hidden"
              animate="show"
              className="mx-auto flex max-w-[520px] flex-1 flex-col items-center justify-center py-12 text-center"
              aria-live="polite"
            >
              <motion.p variants={riseIn} className="text-[15px] font-bold uppercase tracking-wide text-[var(--text-muted)]">
                {state.terms.length ? "Game over" : "Nothing to blast"}
              </motion.p>
              <motion.p variants={riseIn} className="mt-3 text-[64px] font-extrabold leading-none tabular-nums">
                {state.score}
              </motion.p>
              <motion.dl variants={riseIn} className="mt-6 grid grid-cols-3 gap-3 text-[13px] font-semibold text-[var(--text-muted)]">
                <Stat label="Level" value={state.level} />
                <Stat label="Hits" value={state.hits} />
                <Stat label="Best streak" value={state.bestStreak} />
              </motion.dl>
              <motion.div variants={riseIn} className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Button size="lg" onClick={start} autoFocus disabled={!state.terms.length}>
                  Play again
                </Button>
                <NavButton href={routes.set(set.id)} size="lg" variant="secondary">
                    Back to set
                  </NavButton>
              </motion.div>
            </motion.section>
          )}
        </AnimatePresence>
      </main>
    </StudyScreen>
  );
}

function Lives({ lives }: { lives: number }) {
  return (
    <span className="inline-flex items-center gap-0.5" aria-label={`${lives} lives left`} role="img">
      {Array.from({ length: BLAST_LIVES }, (_, i) => (
        <Heart
          key={i}
          className={cn("h-4 w-4", i < lives ? "text-[var(--incorrect)]" : "text-[var(--border)]")}
          fill={i < lives ? "currentColor" : "none"}
          aria-hidden
        />
      ))}
    </span>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-[12px] bg-[var(--surface)] px-4 py-3 shadow-[var(--shadow-sm)]">
      <dt>{label}</dt>
      <dd className="mt-1 text-[22px] font-extrabold tabular-nums text-[var(--text)]">{value}</dd>
    </div>
  );
}

function Falling({ tile }: { tile: BlastTile }) {
  const urgent = tile.y > 0.72;
  return (
    <motion.div
      data-blast-tile={tile.id}
      initial={{ opacity: 0, scale: 0.85 }}
      animate={{ opacity: 1, scale: 1, transition: spring.snap }}
      className={cn(
        "absolute max-w-[min(46vw,240px)] rounded-[10px] border-2 bg-[var(--surface)] px-3 py-2 text-center text-[13px] font-medium leading-snug shadow-[var(--shadow-md)] md:text-[15px]",
        urgent ? "border-[var(--incorrect)]" : "border-[var(--border-soft)]",
      )}
      style={{ left: `${tile.x * 100}%`, top: `${tile.y * 100}%`, x: "-50%", y: "-100%" }}
    >
      <span className="line-clamp-3 whitespace-pre-wrap break-words">{tile.text}</span>
    </motion.div>
  );
}

const PARTICLES = 8;

function Pop({ pop, reduce }: { pop: BlastPop; reduce: boolean }) {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute"
      style={{ left: `${pop.x * 100}%`, top: `${pop.y * 100}%`, transform: "translate(-50%, -100%)" }}
    >
      {!reduce &&
        Array.from({ length: PARTICLES }, (_, i) => {
          const a = (i / PARTICLES) * Math.PI * 2;
          return (
            <motion.span
              key={i}
              initial={{ x: 0, y: 0, opacity: 1, scale: 1 }}
              animate={{ x: Math.cos(a) * 60, y: Math.sin(a) * 60 - 20, opacity: 0, scale: 0.3 }}
              transition={{ duration: 0.55, ease: "easeOut" }}
              className="absolute h-2.5 w-2.5 rounded-full"
              style={{ background: i % 2 ? "var(--correct)" : "var(--brand)" }}
            />
          );
        })}
      <motion.span
        initial={{ y: 0, opacity: 1 }}
        animate={{ y: -40, opacity: 0 }}
        transition={{ duration: 0.65, ease: "easeOut" }}
        className="absolute -translate-x-1/2 whitespace-nowrap text-[16px] font-extrabold text-[var(--correct-text)]"
      >
        +{pop.points}
      </motion.span>
    </div>
  );
}
