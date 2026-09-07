"use client";

import { AnimatePresence, motion, useReducedMotion, type PanInfo } from "framer-motion";
import { Timer, Trophy } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { matchRecords, type StudySet, type Term } from "@/lib/db";
import {
  clearMismatch,
  createMatchGame,
  isMatchComplete,
  MATCH_PAIRS,
  MATCH_PENALTY_MS,
  matchElapsed,
  selectTile,
  type MatchState,
  type MatchTile,
} from "@/lib/study/match";
import { seedFrom } from "@/lib/study/random";
import { Button } from "@/components/ui";
import { riseIn, spring, stagger } from "@/lib/motion/springs";
import { cn } from "@/lib/utils/cn";
import { seconds } from "@/lib/utils/format";
import { Confetti } from "../Confetti";
import { useKeydown } from "../hooks/useKeydown";
import { useNow } from "../hooks/useNow";
import { modeMeta } from "../modes";
import { rowIn, shake } from "../motion";
import { routes } from "../routes";
import { NavButton } from "../NavButton";
import { StudyHeader, StudyScreen } from "../StudyHeader";

type Stage = "intro" | "playing" | "done";

export interface MatchProps {
  set: StudySet;
  terms: Term[];
}

const MISMATCH_MS = 550;

export function Match({ set, terms }: MatchProps) {
  const [stage, setStage] = useState<Stage>("intro");
  const [game, setGame] = useState<MatchState | null>(null);
  const [best, setBest] = useState<number | null>(null);
  const [isRecord, setIsRecord] = useState(false);
  const [finalMs, setFinalMs] = useState(0);
  const [round, setRound] = useState(0);
  const doneTimer = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (doneTimer.current) window.clearTimeout(doneTimer.current);
    },
    [],
  );

  useEffect(() => {
    let cancelled = false;
    matchRecords
      .best(set.id)
      .then((r) => {
        if (!cancelled) setBest(r?.timeMs ?? null);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [set.id]);

  const running = stage === "playing" && !!game && game.startedAt !== null && game.finishedAt === null;
  const now = useNow(running);
  const elapsed = game ? matchElapsed(game, now) : 0;

  const start = useCallback(() => {
    const nextRound = round + 1;
    setRound(nextRound);
    const rng = (() => {
      let s = seedFrom(set.id) ^ Date.now() ^ (nextRound * 7919);
      return () => {
        // xorshift32 — cheap, deterministic per game.
        s ^= s << 13;
        s ^= s >>> 17;
        s ^= s << 5;
        return ((s >>> 0) % 1_000_000) / 1_000_000;
      };
    })();
    setGame(createMatchGame(terms, rng, MATCH_PAIRS));
    setIsRecord(false);
    setStage("playing");
  }, [set.id, terms, round]);

  /* Mismatch flash clears itself. */
  useEffect(() => {
    if (!game?.mismatch) return;
    const id = window.setTimeout(() => setGame((g) => (g ? clearMismatch(g) : g)), MISMATCH_MS);
    return () => window.clearTimeout(id);
  }, [game?.mismatch]);

  /* Runs from the tap/drop that clears the last pair: record + summary. */
  const finish = useCallback(
    (final: MatchState) => {
      const ms = matchElapsed(final);
      setFinalMs(ms);
      const record = best === null || ms < best;
      setIsRecord(record);
      if (record) setBest(ms);
      matchRecords.record(set.id, ms, final.tiles.length / 2).catch(() => {});
      doneTimer.current = window.setTimeout(() => setStage("done"), 700);
    },
    [best, set.id],
  );

  const commit = useCallback(
    (next: MatchState) => {
      setGame(next);
      if (isMatchComplete(next)) finish(next);
    },
    [finish],
  );

  const tap = useCallback(
    (tileId: string) => {
      if (!game) return;
      commit(selectTile(game, tileId, Date.now()));
    },
    [game, commit],
  );

  const drop = useCallback(
    (sourceId: string, targetId: string) => {
      if (!game) return;
      const t = Date.now();
      let next = game;
      if (next.selectedId !== sourceId) {
        if (next.selectedId) next = { ...next, selectedId: null };
        next = selectTile(next, sourceId, t);
      }
      commit(selectTile(next, targetId, t));
    },
    [game, commit],
  );

  const pairsAvailable = terms.filter((t) => t.term.trim() && t.definition.trim()).length;

  useKeydown((e) => {
    if (e.key === "Enter" && stage !== "playing" && pairsAvailable > 0) start();
  });

  const meta = modeMeta("match");

  return (
    <StudyScreen>
      <StudyHeader
        mode="match"
        setId={set.id}
        title={set.title}
        center={
          stage === "playing" ? (
            <p className="inline-flex items-center gap-1.5 text-[18px] font-extrabold tabular-nums" aria-live="off">
              <Timer className="h-5 w-5 text-[var(--text-muted)]" aria-hidden />
              {seconds(elapsed)}
              <span className="text-[13px] font-semibold text-[var(--text-muted)]">sec</span>
            </p>
          ) : undefined
        }
      />

      <main className="mx-auto flex w-full max-w-[1000px] flex-1 flex-col px-3 pb-10 pt-4 md:px-6 md:pt-6">
        <AnimatePresence mode="wait" initial={false}>
          {stage === "intro" && (
            <motion.section
              key="intro"
              variants={stagger(0.06)}
              initial="hidden"
              animate="show"
              exit={{ opacity: 0, transition: { duration: 0.12 } }}
              className="mx-auto flex max-w-[520px] flex-1 flex-col items-center justify-center py-12 text-center"
            >
              <motion.span
                variants={riseIn}
                className="inline-flex h-20 w-20 items-center justify-center rounded-[20px] bg-[var(--brand-soft)] text-[var(--brand)]"
              >
                <meta.Icon className="h-10 w-10" aria-hidden />
              </motion.span>
              <motion.h2 variants={riseIn} className="mt-6 text-[32px] leading-tight md:text-[40px]">
                Ready to play?
              </motion.h2>
              <motion.p variants={riseIn} className="mt-3 text-[16px] text-[var(--text-muted)]">
                Match all the terms with their definitions as fast as you can. Avoid wrong matches — they add{" "}
                {MATCH_PENALTY_MS / 1000}s extra time!
              </motion.p>
              {best !== null && (
                <motion.p variants={riseIn} className="mt-4 inline-flex items-center gap-2 rounded-full bg-[var(--star-bg)] px-4 py-1.5 text-[14px] font-bold">
                  <Trophy className="h-4 w-4 text-[var(--star)]" aria-hidden /> Best time: {seconds(best)} sec
                </motion.p>
              )}
              <motion.div variants={riseIn} className="mt-8">
                <Button size="lg" onClick={start} autoFocus disabled={pairsAvailable === 0}>
                  Start game
                </Button>
                {pairsAvailable === 0 && (
                  <p className="mt-3 text-[13px] font-semibold text-[var(--incorrect-text)]">
                    Every term needs both a term and a definition to play Match.
                  </p>
                )}
              </motion.div>
            </motion.section>
          )}

          {stage === "playing" && game && (
            <motion.div
              key={`game-${round}`}
              variants={stagger(0.03)}
              initial="hidden"
              animate="show"
              exit={{ opacity: 0, scale: 0.98, transition: { duration: 0.15 } }}
              className="grid grid-cols-3 gap-3 sm:grid-cols-4"
              role="group"
              aria-label="Match tiles"
            >
              {game.tiles.map((tile) => (
                <Tile
                  key={tile.id}
                  tile={tile}
                  selected={game.selectedId === tile.id}
                  matched={game.matchedIds.includes(tile.id)}
                  mismatched={!!game.mismatch?.includes(tile.id)}
                  onTap={() => tap(tile.id)}
                  onDrop={(targetId) => drop(tile.id, targetId)}
                />
              ))}
            </motion.div>
          )}

          {stage === "done" && (
            <motion.section
              key="done"
              variants={stagger(0.06)}
              initial="hidden"
              animate="show"
              className="relative mx-auto flex max-w-[520px] flex-1 flex-col items-center justify-center py-12 text-center"
              aria-live="polite"
            >
              {isRecord && <Confetti />}
              <motion.p variants={riseIn} className="text-[15px] font-bold uppercase tracking-wide text-[var(--text-muted)]">
                {isRecord ? "New personal best!" : "Nice work!"}
              </motion.p>
              <motion.p variants={riseIn} className="mt-3 text-[56px] font-extrabold leading-none tabular-nums md:text-[72px]">
                {seconds(finalMs)}
                <span className="ml-2 text-[20px] font-bold text-[var(--text-muted)]">sec</span>
              </motion.p>
              {game && game.wrong > 0 && (
                <motion.p variants={riseIn} className="mt-3 text-[14px] font-semibold text-[var(--text-muted)]">
                  Includes {game.wrong * (MATCH_PENALTY_MS / 1000)}s of penalties for {game.wrong} wrong{" "}
                  {game.wrong === 1 ? "match" : "matches"}.
                </motion.p>
              )}
              {!isRecord && best !== null && (
                <motion.p variants={riseIn} className="mt-4 inline-flex items-center gap-2 rounded-full bg-[var(--star-bg)] px-4 py-1.5 text-[14px] font-bold">
                  <Trophy className="h-4 w-4 text-[var(--star)]" aria-hidden /> Best: {seconds(best)} sec
                </motion.p>
              )}
              <motion.div variants={riseIn} className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Button size="lg" onClick={start} autoFocus>
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

function Tile({
  tile,
  selected,
  matched,
  mismatched,
  onTap,
  onDrop,
}: {
  tile: MatchTile;
  selected: boolean;
  matched: boolean;
  mismatched: boolean;
  onTap: () => void;
  onDrop: (targetId: string) => void;
}) {
  const reduce = useReducedMotion();
  const dragging = useRef(false);

  const onDragEnd = (_: unknown, info: PanInfo) => {
    const x = info.point.x - window.scrollX;
    const y = info.point.y - window.scrollY;
    const hit = document
      .elementsFromPoint(x, y)
      .find((el) => el instanceof HTMLElement && el.dataset.tileId && el.dataset.tileId !== tile.id) as
      | HTMLElement
      | undefined;
    if (hit?.dataset.tileId) onDrop(hit.dataset.tileId);
    window.setTimeout(() => {
      dragging.current = false;
    }, 0);
  };

  const size = tile.text.length > 80 ? "text-[12px] md:text-[13px]" : tile.text.length > 40 ? "text-[13px] md:text-[15px]" : "text-[15px] md:text-[17px]";

  return (
    <motion.div variants={rowIn} layout className="min-h-[104px] md:min-h-[132px]">
      <motion.button
        type="button"
        data-tile-id={tile.id}
        drag={!matched && !reduce}
        dragSnapToOrigin
        dragElastic={0.6}
        dragMomentum={false}
        whileDrag={{ scale: 1.06, zIndex: 20 }}
        whileHover={matched ? undefined : { y: -2 }}
        onDragStart={() => {
          dragging.current = true;
        }}
        onDragEnd={onDragEnd}
        onClick={() => {
          if (!dragging.current) onTap();
        }}
        animate={
          matched
            ? { scale: [1, 1.08, 0], opacity: [1, 1, 0], transition: { duration: reduce ? 0 : 0.45, times: [0, 0.4, 1] } }
            : mismatched && !reduce
              ? shake
              : { scale: 1, opacity: 1, x: 0 }
        }
        transition={spring.snap}
        disabled={matched}
        aria-pressed={selected}
        aria-label={`${tile.side === "term" ? "Term" : "Definition"}: ${tile.text}`}
        className={cn(
          "relative flex h-full w-full cursor-grab touch-none select-none items-center justify-center rounded-[10px] border-2 p-3 text-center font-medium leading-snug",
          "bg-[var(--surface)] text-[var(--text)] shadow-[var(--shadow-sm)] transition-colors duration-150 md:p-4",
          "active:cursor-grabbing active:shadow-[var(--shadow-lg)] disabled:pointer-events-none",
          size,
          !selected && !mismatched && !matched && "border-[var(--border-soft)] hover:border-[var(--border)]",
          selected && "border-[var(--brand)] bg-[var(--brand-soft)]",
          mismatched && "border-[var(--incorrect)] bg-[var(--incorrect-bg)] text-[var(--incorrect-text)]",
          matched && "border-[var(--correct)] bg-[var(--correct-bg)] text-[var(--correct-text)]",
        )}
      >
        <span className="line-clamp-5 whitespace-pre-wrap break-words">{tile.text}</span>
      </motion.button>
    </motion.div>
  );
}
