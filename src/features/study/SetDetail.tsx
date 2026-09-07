"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ArrowLeft, ArrowRight, Maximize, MoreHorizontal, Pencil, Plus, RotateCcw, Shuffle, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useReducer, useRef, useState } from "react";
import {
  progress as progressRepo,
  sets as setsRepo,
  terms as termsRepo,
  type Term,
} from "@/lib/db";
import { createFlashcards, currentCardId, deckPosition, flashcardsReducer } from "@/lib/study/flashcards";
import { seedFrom } from "@/lib/study/random";
import { summarize } from "@/lib/study/scheduler";
import { Button, Dialog, IconButton, Segmented, Spinner, toast, Tooltip } from "@/components/ui";
import { riseIn, spring, stagger } from "@/lib/motion/springs";
import { cn } from "@/lib/utils/cn";
import { pluralize, relativeTime } from "@/lib/utils/format";
import { EmptyState } from "./EmptyState";
import { FlipCard } from "./flashcards/FlipCard";
import { useKeydown } from "./hooks/useKeydown";
import { useStudySet } from "./hooks/useStudySet";
import { ModeTiles } from "./ModeTiles";
import { routes } from "./routes";
import { NavButton } from "./NavButton";
import { TermList } from "./TermList";

type Sort = "original" | "alphabetical";

export function SetDetail({ id }: { id: string }) {
  const router = useRouter();
  const { status, set, terms, progress, reload, patchTerm } = useStudySet(id);
  const [sort, setSort] = useState<Sort>("original");
  const [menu, setMenu] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const menuRoot = useRef<HTMLDivElement>(null);

  /* Close the "More" menu on outside tap or Escape — mouse-leave alone never fires on touch. */
  useEffect(() => {
    if (!menu) return;
    const onDown = (e: PointerEvent) => {
      if (!menuRoot.current?.contains(e.target as Node)) setMenu(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenu(false);
    };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [menu]);

  const sorted = useMemo(
    () =>
      sort === "alphabetical"
        ? terms.slice().sort((a, b) => a.term.localeCompare(b.term, undefined, { sensitivity: "base" }))
        : terms,
    [terms, sort],
  );
  const mastery = useMemo(() => summarize(terms.map((t) => progress.get(t.id)!).filter(Boolean)), [terms, progress]);

  if (status === "loading") {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Spinner size={32} />
      </div>
    );
  }

  if (status === "missing" || !set) {
    return (
      <EmptyState
        title="We couldn't find that set"
        description="It may have been deleted, or the link is wrong."
        actions={
          <NavButton href={routes.sets}>Browse your sets</NavButton>
        }
      />
    );
  }

  const toggleStar = async (term: Term) => {
    patchTerm(term.id, { starred: !term.starred });
    await termsRepo.toggleStar(term.id);
  };

  const resetProgress = async () => {
    await progressRepo.resetSet(set.id);
    await reload();
    toast.success("Progress reset");
    setMenu(false);
  };

  const remove = async () => {
    await setsRepo.remove(set.id);
    toast.show("Set deleted");
    router.push(routes.sets);
  };

  return (
    <motion.main
      variants={stagger(0.05)}
      initial="hidden"
      animate="show"
      className="mx-auto w-full max-w-[1000px] px-4 pb-24 pt-8 md:px-8 md:pt-12"
    >
      <motion.div variants={riseIn}>
        <Link
          href={routes.sets}
          className="inline-flex items-center gap-1.5 text-[13px] font-bold text-[var(--text-muted)] transition-colors hover:text-[var(--text)]"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden /> Your sets
        </Link>
      </motion.div>

      <motion.header variants={riseIn} className="mt-4 flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-[24px] leading-[1.15] md:text-[30px]">{set.title}</h1>
          <p className="mt-1.5 text-[13px] text-[var(--text-muted)]">
            {pluralize(terms.length, "term")} · Updated {relativeTime(set.updatedAt)}
          </p>
          {set.description && (
            <p className="mt-3 max-w-[640px] whitespace-pre-wrap text-[15px] text-[var(--text)]">{set.description}</p>
          )}
        </div>
        <div ref={menuRoot} className="relative flex shrink-0 items-center gap-1">
          <Tooltip label="Edit set">
            <Link
              href={routes.edit(set.id)}
              aria-label="Edit set"
              className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-[var(--border)] text-[var(--text)] transition-colors hover:bg-[var(--surface-2)]"
            >
              <Pencil className="h-4 w-4" />
            </Link>
          </Tooltip>
          <IconButton
            label="More"
            aria-haspopup="menu"
            aria-expanded={menu}
            onClick={() => setMenu((v) => !v)}
            className="border border-[var(--border)] text-[var(--text)]"
          >
            <MoreHorizontal />
          </IconButton>
          <AnimatePresence>
            {menu && (
              <motion.div
                role="menu"
                initial={{ opacity: 0, y: -6, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1, transition: spring.snap }}
                exit={{ opacity: 0, y: -4, transition: { duration: 0.1 } }}
                className="absolute right-0 top-full z-20 mt-2 w-52 rounded-[12px] border border-[var(--border-soft)] bg-[var(--surface)] p-1.5 shadow-[var(--shadow-lg)]"
              >
                <MenuItem icon={<RotateCcw className="h-4 w-4" />} onClick={resetProgress}>
                  Reset progress
                </MenuItem>
                <MenuItem
                  icon={<Trash2 className="h-4 w-4" />}
                  danger
                  onClick={() => {
                    setMenu(false);
                    setConfirmDelete(true);
                  }}
                >
                  Delete set
                </MenuItem>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.header>

      {mastery.total > 0 && mastery.notStarted < mastery.total && (
        <motion.div variants={riseIn} className="mt-5 flex items-center gap-3 text-[13px] font-semibold text-[var(--text-muted)]">
          <div className="flex h-2 flex-1 max-w-[280px] overflow-hidden rounded-full bg-[var(--track)]">
            <span className="h-full bg-[var(--correct)]" style={{ width: `${(mastery.mastered / mastery.total) * 100}%` }} />
            <span className="h-full bg-[var(--incorrect)]" style={{ width: `${(mastery.learning / mastery.total) * 100}%` }} />
          </div>
          <span>
            {mastery.mastered} mastered · {mastery.learning} still learning
          </span>
        </motion.div>
      )}

      <ModeTiles setId={set.id} className="mt-7" />

      {terms.length ? (
        <>
          <PreviewDeck key={terms.map((t) => t.id).join(",")} setId={set.id} terms={terms} onToggleStar={toggleStar} />

          <motion.section variants={riseIn} className="mt-12">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-[20px]">Terms in this set ({terms.length})</h2>
              <Segmented
                id="term-sort"
                value={sort}
                onChange={setSort}
                options={[
                  { value: "original", label: "Original" },
                  { value: "alphabetical", label: "Alphabetical" },
                ]}
              />
            </div>
            <TermList terms={sorted} onToggleStar={toggleStar} editHref={routes.edit(set.id)} className="mt-4" />
          </motion.section>

          <motion.div variants={riseIn} className="mt-8 flex flex-wrap gap-3">
            <NavButton href={routes.edit(set.id)} variant="secondary" leading={<Plus className="h-4 w-4" />}>
                Add or remove terms
              </NavButton>
          </motion.div>
        </>
      ) : (
        <EmptyState
          title="This set has no terms yet"
          description="Add a few terms and definitions to start studying."
          actions={
            <NavButton href={routes.edit(set.id)} leading={<Plus className="h-4 w-4" />}>
                Add terms
              </NavButton>
          }
        />
      )}

      <Dialog
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        title="Delete this set?"
        description="Its terms and study progress will be removed from this device. This can't be undone."
        width="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirmDelete(false)}>
              Cancel
            </Button>
            <Button variant="danger" onClick={remove}>
              Delete
            </Button>
          </>
        }
      />
    </motion.main>
  );
}

function MenuItem({
  icon,
  danger,
  onClick,
  children,
}: {
  icon: React.ReactNode;
  danger?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-3 rounded-[8px] px-3 py-2.5 text-left text-[14px] font-semibold transition-colors",
        danger
          ? "text-[var(--incorrect-text)] hover:bg-[var(--incorrect-bg)]"
          : "text-[var(--text)] hover:bg-[var(--surface-2)]",
      )}
    >
      {icon}
      {children}
    </button>
  );
}

/** The flashcard preview that sits between the mode tiles and the term list. */
function PreviewDeck({
  setId,
  terms,
  onToggleStar,
}: {
  setId: string;
  terms: Term[];
  onToggleStar: (t: Term) => void;
}) {
  const reduce = useReducedMotion();
  const [state, dispatch] = useReducer(flashcardsReducer, undefined, () =>
    createFlashcards(terms, { seed: seedFrom(setId) }),
  );
  const byId = useMemo(() => new Map(terms.map((t) => [t.id, t])), [terms]);
  const card = byId.get(currentCardId(state) ?? "") ?? null;
  const { position, total } = deckPosition(state);

  useEffect(() => {
    if (state.finished) dispatch({ type: "goto", index: 0 });
  }, [state.finished]);

  useKeydown((e) => {
    if (e.key === "ArrowRight") dispatch({ type: "next" });
    if (e.key === "ArrowLeft") dispatch({ type: "prev" });
  });

  const circle =
    "inline-flex h-11 w-11 items-center justify-center rounded-full border border-[var(--border)] " +
    "text-[var(--text)] transition-colors hover:bg-[var(--surface-2)] disabled:opacity-30 disabled:pointer-events-none";

  return (
    <motion.section variants={riseIn} className="mt-8" aria-label="Flashcard preview">
      <div className="h-[320px] md:h-[400px]">
        <AnimatePresence initial={false} mode="popLayout">
          {card && (
            <motion.div
              key={card.id}
              initial={reduce ? false : { opacity: 0, x: 24 }}
              animate={{ opacity: 1, x: 0, transition: spring.card }}
              exit={{ opacity: 0, x: -24, transition: { duration: 0.1 } }}
              className="h-full w-full"
            >
              <FlipCard
                front={card.term}
                back={card.definition}
                frontLabel="Term"
                backLabel="Definition"
                flipped={state.flipped}
                onFlip={() => dispatch({ type: "flip" })}
                starred={card.starred}
                onToggleStar={() => onToggleStar(card)}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="mt-4 grid grid-cols-[1fr_auto_1fr] items-center">
        <span />
        <div className="flex items-center gap-4">
          <button
            type="button"
            aria-label="Previous card"
            className={circle}
            disabled={state.index === 0}
            onClick={() => dispatch({ type: "prev" })}
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <span className="min-w-[64px] text-center text-[15px] font-bold tabular-nums">
            {position} / {total}
          </span>
          <button
            type="button"
            aria-label="Next card"
            className={circle}
            disabled={state.index >= total - 1}
            onClick={() => dispatch({ type: "next" })}
          >
            <ArrowRight className="h-5 w-5" />
          </button>
        </div>
        <div className="flex items-center justify-end gap-1">
          <Tooltip label="Shuffle">
            <IconButton label="Shuffle" active={state.shuffled} onClick={() => dispatch({ type: "toggle-shuffle" })}>
              <Shuffle />
            </IconButton>
          </Tooltip>
          <Tooltip label="Study in fullscreen">
            <Link
              href={routes.study(setId, "flashcards")}
              aria-label="Open flashcards"
              className="inline-flex h-10 w-10 items-center justify-center rounded-full text-[var(--text-muted)] transition-colors hover:bg-[var(--surface-2)] hover:text-[var(--text)]"
            >
              <Maximize className="h-5 w-5" />
            </Link>
          </Tooltip>
        </div>
      </div>
    </motion.section>
  );
}
