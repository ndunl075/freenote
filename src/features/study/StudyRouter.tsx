"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Layers, Plus } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo } from "react";
import type { StudyMode } from "@/lib/db";
import { FullPageSpinner } from "@/components/ui";
import { NavButton } from "./NavButton";
import { Blast } from "./blast/Blast";
import { EmptyState } from "./EmptyState";
import { Flashcards } from "./flashcards/Flashcards";
import { useSettings } from "./hooks/useSettings";
import { useStudySet } from "./hooks/useStudySet";
import { Learn } from "./learn/Learn";
import { Match } from "./match/Match";
import { screenSwap } from "./motion";
import { isStudyMode, routes } from "./routes";
import { TestMode } from "./test/TestMode";

/** `/study?set=&mode=` — loads the set once and mounts the requested mode. */
export function StudyRouter() {
  const params = useSearchParams();
  const setId = params.get("set");
  const modeParam = params.get("mode");
  const mode: StudyMode = isStudyMode(modeParam) ? modeParam : "flashcards";

  const data = useStudySet(setId);
  const { settings, loaded } = useSettings();

  /* Progress may have changed in the previous mode — refresh on switch. */
  useEffect(() => {
    if (data.status === "ready") void data.reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  const usable = useMemo(() => data.terms.filter((t) => t.term.trim() || t.definition.trim()), [data.terms]);

  if (!setId) {
    return (
      <EmptyState
        Icon={Layers}
        title="Pick a set to study"
        description="Open one of your sets and choose a study mode."
        actions={
          <NavButton href={routes.sets}>Your sets</NavButton>
        }
      />
    );
  }

  if (data.status === "loading" || !loaded) return <FullPageSpinner />;

  if (data.status === "missing" || !data.set) {
    return (
      <EmptyState
        title="We couldn't find that set"
        description="It may have been deleted, or the link is wrong."
        actions={
          <NavButton href={routes.sets}>Your sets</NavButton>
        }
      />
    );
  }

  if (!usable.length) {
    return (
      <EmptyState
        title="Add some terms first"
        description="This set is empty. Add at least one term and definition to start studying."
        actions={
          <NavButton href={routes.edit(data.set.id)} leading={<Plus className="h-4 w-4" />}>
              Add terms
            </NavButton>
        }
      />
    );
  }

  const set = data.set;
  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div key={mode} variants={screenSwap} initial="hidden" animate="show" exit="exit" className="min-h-screen">
        {mode === "flashcards" && <Flashcards set={set} terms={usable} settings={settings} onPatchTerm={data.patchTerm} />}
        {mode === "learn" && <Learn set={set} terms={usable} settings={settings} />}
        {mode === "test" && <TestMode set={set} terms={usable} settings={settings} />}
        {mode === "match" && <Match set={set} terms={usable} />}
        {mode === "blast" && <Blast set={set} terms={usable} settings={settings} />}
      </motion.div>
    </AnimatePresence>
  );
}
