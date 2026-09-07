"use client";

import { useCallback, useEffect, useState } from "react";
import { progress as progressRepo, sets, terms as termsRepo } from "@/lib/db";
import type { Progress, StudySet, Term } from "@/lib/db";

export type StudySetStatus = "loading" | "missing" | "ready";

export interface StudySetData {
  status: StudySetStatus;
  set: StudySet | null;
  terms: Term[];
  progress: Map<string, Progress>;
  /** Re-read everything from IndexedDB. */
  reload: () => Promise<void>;
  /** Optimistically patch a term in memory (star toggles etc.). */
  patchTerm: (id: string, patch: Partial<Term>) => void;
}

interface Loaded {
  /** The id this snapshot belongs to — anything else is still loading. */
  forId: string | null;
  found: boolean;
  set: StudySet | null;
  terms: Term[];
  progress: Map<string, Progress>;
}

const EMPTY: Loaded = { forId: null, found: false, set: null, terms: [], progress: new Map() };

async function fetchSet(id: string): Promise<Loaded> {
  const found = await sets.get(id);
  if (!found) return { ...EMPTY, forId: id };
  const list = await termsRepo.forSet(id);
  const map = await progressRepo.hydrate(id, list.map((t) => t.id));
  return { forId: id, found: true, set: found, terms: list, progress: map };
}

/** Loads a set, its ordered terms, and hydrated progress for every term. */
export function useStudySet(id: string | null): StudySetData {
  const [loaded, setLoaded] = useState<Loaded>(EMPTY);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    fetchSet(id)
      .then((data) => {
        if (!cancelled) setLoaded(data);
      })
      .catch(() => {
        if (!cancelled) setLoaded({ ...EMPTY, forId: id });
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  const reload = useCallback(async () => {
    if (!id) return;
    setLoaded(await fetchSet(id));
  }, [id]);

  const patchTerm = useCallback((termId: string, patch: Partial<Term>) => {
    setLoaded((prev) => ({
      ...prev,
      terms: prev.terms.map((t) => (t.id === termId ? { ...t, ...patch } : t)),
    }));
  }, []);

  const current = loaded.forId === id;
  const status: StudySetStatus = !id ? "missing" : !current ? "loading" : loaded.found ? "ready" : "missing";

  return {
    status,
    set: current ? loaded.set : null,
    terms: current ? loaded.terms : [],
    progress: current ? loaded.progress : EMPTY.progress,
    reload,
    patchTerm,
  };
}
