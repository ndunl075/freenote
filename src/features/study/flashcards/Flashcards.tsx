"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Maximize,
  Minimize,
  Pause,
  Play,
  Settings,
  Shuffle,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import { terms as termsRepo, type Settings as AppSettings, type StudySet, type Term } from "@/lib/db";
import {
  createFlashcards,
  currentCardId,
  deckPosition,
  flashcardsReducer,
  type CardSide,
  type Pile,
} from "@/lib/study/flashcards";
import { seedFrom } from "@/lib/study/random";
import { Button, Dialog, IconButton, Progress, Segmented, Switch, Tooltip } from "@/components/ui";
import { spring } from "@/lib/motion/springs";
import { cn } from "@/lib/utils/cn";
import { useFullscreen } from "../hooks/useFullscreen";
import { useKeydown } from "../hooks/useKeydown";
import { StudyHeader, StudyScreen } from "../StudyHeader";
import { FlashcardsSummary } from "./FlashcardsSummary";
import { SwipeCard, type SwipeCardHandle } from "./SwipeCard";

export interface FlashcardsProps {
  set: StudySet;
  terms: Term[];
  settings: AppSettings;
  onPatchTerm: (id: string, patch: Partial<Term>) => void;
}

const sideLabel = (side: CardSide) => (side === "term" ? "Term" : "Definition");

export function Flashcards({ set, terms, settings, onPatchTerm }: FlashcardsProps) {
  const reduce = useReducedMotion();
  const [state, dispatch] = useReducer(
    flashcardsReducer,
    undefined,
    () => createFlashcards(terms, { seed: seedFrom(set.id) ^ Date.now() }),
  );
  const [autoplayOn, setAutoplayOn] = useState(false);
  const [options, setOptions] = useState(false);
  const [fullscreen, toggleFullscreen] = useFullscreen();
  const swipe = useRef<SwipeCardHandle>(null);

  const byId = useMemo(() => new Map(terms.map((t) => [t.id, t])), [terms]);
  const cardId = currentCardId(state);
  const card = cardId ? byId.get(cardId) : undefined;
  const { position, total } = deckPosition(state);
  const frontText = card ? (state.front === "term" ? card.term : card.definition) : "";
  const backText = card ? (state.front === "term" ? card.definition : card.term) : "";

  /* Autoplay stops by itself at the end of the deck. */
  const autoplay = autoplayOn && !state.finished;
  const toggleAutoplay = () => setAutoplayOn(!autoplay);

  /* Autoplay: flip after N seconds, then advance after N more. */
  useEffect(() => {
    if (!autoplay || !card) return;
    const ms = Math.max(1, settings.autoplaySeconds) * 1000;
    const id = window.setTimeout(() => {
      dispatch({ type: state.flipped ? "next" : "flip" });
    }, ms);
    return () => window.clearTimeout(id);
  }, [autoplay, state.flipped, state.index, card, settings.autoplaySeconds]);

  const sort = useCallback((pile: Pile) => {
    if (swipe.current) swipe.current.fling(pile);
    else dispatch({ type: "sort", pile });
  }, []);

  const goNext = useCallback(() => {
    if (state.sorting) sort("know");
    else dispatch({ type: "next" });
  }, [state.sorting, sort]);

  const goPrev = useCallback(() => {
    if (state.sorting && !state.finished) sort("learning");
    else dispatch({ type: "prev" });
  }, [state.sorting, state.finished, sort]);

  useKeydown(
    (e) => {
      if (options) return;
      switch (e.key) {
        case "ArrowRight":
          e.preventDefault();
          if (!state.finished) goNext();
          break;
        case "ArrowLeft":
          e.preventDefault();
          goPrev();
          break;
        case " ":
        case "Enter": {
          // Let focused buttons (and the card itself) handle their own activation.
          const el = e.target instanceof HTMLElement ? e.target : null;
          if (el && (el.tagName === "BUTTON" || el.getAttribute("role") === "button")) return;
          e.preventDefault();
          dispatch({ type: "flip" });
          break;
        }
        case "s":
        case "S":
          dispatch({ type: "toggle-shuffle" });
          break;
        case "f":
        case "F":
          toggleFullscreen();
          break;
        case "p":
        case "P":
          toggleAutoplay();
          break;
      }
    },
    { enabled: true },
  );

  const toggleStar = async (term: Term) => {
    onPatchTerm(term.id, { starred: !term.starred });
    await termsRepo.toggleStar(term.id);
  };

  const circle =
    "inline-flex h-12 w-12 items-center justify-center rounded-full border transition-colors " +
    "disabled:opacity-30 disabled:pointer-events-none";

  return (
    <StudyScreen>
      <StudyHeader
        mode="flashcards"
        setId={set.id}
        title={set.title}
        center={
          <p className="text-[15px] font-bold tabular-nums text-[var(--text)]" aria-live="polite">
            {position} / {total}
          </p>
        }
        right={
          <IconButton label="Options" onClick={() => setOptions(true)}>
            <Settings />
          </IconButton>
        }
      />

      <main className="mx-auto flex w-full max-w-[900px] flex-1 flex-col px-3 pb-8 md:px-6">
        <AnimatePresence mode="wait" initial={false}>
          {state.finished ? (
            <motion.div
              key="summary"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0, transition: spring.soft }}
              exit={{ opacity: 0, transition: { duration: 0.12 } }}
            >
              <FlashcardsSummary
                setId={set.id}
                total={total}
                know={state.know.length}
                learning={state.learning.length}
                sorting={state.sorting}
                onReview={() => dispatch({ type: "review-learning" })}
                onRestart={() => dispatch({ type: "restart" })}
              />
            </motion.div>
          ) : (
            <motion.div
              key="deck"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0, transition: { duration: 0.12 } }}
              className="flex flex-1 flex-col"
            >
              <div className="relative mt-3 md:mt-6">
                {state.sorting && (
                  <>
                    <PileCounter side="left" count={state.learning.length} label="Still learning" />
                    <PileCounter side="right" count={state.know.length} label="Know" />
                  </>
                )}
                <div className="h-[min(62vh,540px)] min-h-[300px] w-full">
                  <AnimatePresence initial={false} mode="popLayout">
                    {card && (
                      <motion.div
                        key={card.id + state.front}
                        initial={reduce ? false : { opacity: 0, scale: 0.96, y: 8 }}
                        animate={{ opacity: 1, scale: 1, y: 0, transition: spring.card }}
                        exit={{ opacity: 0, transition: { duration: 0.08 } }}
                        className="h-full w-full"
                      >
                        <SwipeCard
                          ref={swipe}
                          sortable={state.sorting}
                          onSort={(pile) => dispatch({ type: "sort", pile })}
                          front={frontText}
                          back={backText}
                          frontLabel={sideLabel(state.front)}
                          backLabel={sideLabel(state.front === "term" ? "definition" : "term")}
                          flipped={state.flipped}
                          onFlip={() => dispatch({ type: "flip" })}
                          starred={card.starred}
                          onToggleStar={() => toggleStar(card)}
                          corner={
                            <span className="hidden text-[12px] font-semibold text-[var(--text-faint)] md:inline">
                              Space to flip
                            </span>
                          }
                        />
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>

              <Progress value={position} max={total} height={4} className="mt-5" />

              <div className="mt-4 grid grid-cols-[1fr_auto_1fr] items-center gap-2">
                <div className="flex items-center gap-2">
                  <Switch
                    checked={state.sorting}
                    onChange={() => dispatch({ type: "toggle-sorting" })}
                    label="Track progress"
                  />
                  <span className="hidden text-[14px] font-semibold text-[var(--text-muted)] sm:inline">
                    Track progress
                  </span>
                </div>

                <div className="flex items-center gap-3 md:gap-5">
                  {state.sorting ? (
                    <Tooltip label="Still learning (←)">
                      <button
                        type="button"
                        aria-label="Still learning"
                        onClick={() => sort("learning")}
                        className={cn(
                          circle,
                          "border-[var(--incorrect)] text-[var(--incorrect)] hover:bg-[var(--incorrect-bg)]",
                        )}
                      >
                        <X className="h-6 w-6" strokeWidth={2.5} />
                      </button>
                    </Tooltip>
                  ) : (
                    <Tooltip label="Previous (←)">
                      <button
                        type="button"
                        aria-label="Previous card"
                        onClick={goPrev}
                        disabled={state.index === 0}
                        className={cn(circle, "border-[var(--border)] text-[var(--text)] hover:bg-[var(--surface-2)]")}
                      >
                        <ArrowLeft className="h-6 w-6" />
                      </button>
                    </Tooltip>
                  )}

                  <span className="min-w-[72px] text-center text-[16px] font-bold tabular-nums">
                    {position} / {total}
                  </span>

                  {state.sorting ? (
                    <Tooltip label="Know (→)">
                      <button
                        type="button"
                        aria-label="Know it"
                        onClick={() => sort("know")}
                        className={cn(
                          circle,
                          "border-[var(--correct)] text-[var(--correct-text)] hover:bg-[var(--correct-bg)]",
                        )}
                      >
                        <Check className="h-6 w-6" strokeWidth={2.5} />
                      </button>
                    </Tooltip>
                  ) : (
                    <Tooltip label="Next (→)">
                      <button
                        type="button"
                        aria-label="Next card"
                        onClick={goNext}
                        className={cn(circle, "border-[var(--border)] text-[var(--text)] hover:bg-[var(--surface-2)]")}
                      >
                        <ArrowRight className="h-6 w-6" />
                      </button>
                    </Tooltip>
                  )}
                </div>

                <div className="flex items-center justify-end gap-1">
                  <Tooltip label="Shuffle (S)">
                    <IconButton
                      label="Shuffle"
                      active={state.shuffled}
                      onClick={() => dispatch({ type: "toggle-shuffle" })}
                    >
                      <Shuffle />
                    </IconButton>
                  </Tooltip>
                  <Tooltip label={autoplay ? "Pause (P)" : "Play (P)"}>
                    <IconButton label={autoplay ? "Pause autoplay" : "Play autoplay"} active={autoplay} onClick={() => toggleAutoplay()}>
                      {autoplay ? <Pause /> : <Play />}
                    </IconButton>
                  </Tooltip>
                  <Tooltip label={fullscreen ? "Exit fullscreen (F)" : "Fullscreen (F)"}>
                    <IconButton label={fullscreen ? "Exit fullscreen" : "Fullscreen"} onClick={toggleFullscreen}>
                      {fullscreen ? <Minimize /> : <Maximize />}
                    </IconButton>
                  </Tooltip>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      <Dialog open={options} onClose={() => setOptions(false)} title="Options" width="sm">
        <div className="flex flex-col gap-6">
          <OptionRow label="Front" hint="Which side shows first">
            <Segmented
              id="flashcards-front"
              value={state.front}
              onChange={(front) => dispatch({ type: "set-front", front })}
              options={[
                { value: "term", label: "Term" },
                { value: "definition", label: "Definition" },
              ]}
            />
          </OptionRow>
          <OptionRow label="Track progress" hint="Sort cards into Know and Still learning">
            <Switch checked={state.sorting} onChange={() => dispatch({ type: "toggle-sorting" })} label="Track progress" />
          </OptionRow>
          <OptionRow label="Shuffle" hint="Randomise the card order">
            <Switch checked={state.shuffled} onChange={() => dispatch({ type: "toggle-shuffle" })} label="Shuffle" />
          </OptionRow>
          <div className="rounded-[12px] bg-[var(--surface-2)] p-4 text-[13px] text-[var(--text-muted)]">
            <p className="mb-2 font-bold text-[var(--text)]">Keyboard shortcuts</p>
            <ul className="grid grid-cols-2 gap-x-4 gap-y-1">
              <li><Kbd>Space</Kbd> Flip</li>
              <li><Kbd>→</Kbd> Next / Know</li>
              <li><Kbd>←</Kbd> Back / Still learning</li>
              <li><Kbd>S</Kbd> Shuffle</li>
              <li><Kbd>P</Kbd> Autoplay</li>
              <li><Kbd>F</Kbd> Fullscreen</li>
            </ul>
          </div>
          <Button
            variant="secondary"
            onClick={() => {
              dispatch({ type: "restart" });
              setOptions(false);
            }}
          >
            Restart Flashcards
          </Button>
        </div>
      </Dialog>
    </StudyScreen>
  );
}

function OptionRow({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div>
        <p className="text-[15px] font-bold">{label}</p>
        {hint && <p className="text-[13px] text-[var(--text-muted)]">{hint}</p>}
      </div>
      {children}
    </div>
  );
}

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="mr-1 inline-block rounded-[4px] border border-[var(--border)] bg-[var(--surface)] px-1.5 py-0.5 font-sans text-[11px] font-bold text-[var(--text)]">
      {children}
    </kbd>
  );
}

function PileCounter({ side, count, label }: { side: "left" | "right"; count: number; label: string }) {
  const color = side === "left" ? "var(--incorrect-text)" : "var(--correct-text)";
  const border = side === "left" ? "var(--incorrect)" : "var(--correct)";
  const bg = side === "left" ? "var(--incorrect-bg)" : "var(--correct-bg)";
  return (
    <motion.div
      layoutId={side === "left" ? "pile-learning" : "pile-know"}
      transition={spring.soft}
      className={cn(
        "absolute top-4 z-10 inline-flex min-w-[52px] items-center justify-center rounded-full border px-3 py-1",
        "text-[16px] font-semibold tabular-nums shadow-[var(--shadow-sm)]",
        side === "left" ? "-left-2 md:-left-5" : "-right-2 md:-right-5",
      )}
      style={{ borderColor: border, color, background: bg }}
      aria-label={`${label}: ${count}`}
      role="status"
    >
      <motion.span key={count} initial={{ scale: 1.4 }} animate={{ scale: 1 }} transition={spring.snap}>
        {count}
      </motion.span>
    </motion.div>
  );
}
