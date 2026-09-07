"use client";

import { AnimatePresence, motion, Reorder } from "framer-motion";
import { Import, Plus } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { sets as setsRepo, terms as termsRepo } from "@/lib/db";
import { Button, Input, Spinner, toast } from "@/components/ui";
import { riseIn, stagger } from "@/lib/motion/springs";
import { newId } from "@/lib/utils/id";
import { EmptyState } from "../EmptyState";
import { routes } from "../routes";
import { NavButton } from "../NavButton";
import { ImportDialog } from "./ImportDialog";
import { TermCardEditor, type DraftTerm } from "./TermCardEditor";

const blank = (): DraftTerm => ({ key: newId("draft"), termId: null, term: "", definition: "", imageBlobId: null });

const SAVE_DEBOUNCE_MS = 500;

/** `/create-set?id=` — Quizlet's set editor. New sets persist on "Create"; existing ones autosave. */
export function SetEditor() {
  const params = useSearchParams();
  const router = useRouter();
  const id = params.get("id");

  const [status, setStatus] = useState<"loading" | "missing" | "ready">(id ? "loading" : "ready");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [rows, setRows] = useState<DraftTerm[]>(() => [blank(), blank()]);
  const [focusKey, setFocusKey] = useState<string | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  /* Load an existing set. */
  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    (async () => {
      const set = await setsRepo.get(id);
      if (!set) {
        if (!cancelled) setStatus("missing");
        return;
      }
      const list = await termsRepo.forSet(id);
      if (cancelled) return;
      setTitle(set.title);
      setDescription(set.description);
      setRows(
        list.length
          ? list.map((t) => ({ key: t.id, termId: t.id, term: t.term, definition: t.definition, imageBlobId: t.imageBlobId }))
          : [blank()],
      );
      setStatus("ready");
    })().catch(() => {
      if (!cancelled) setStatus("missing");
    });
    return () => {
      cancelled = true;
    };
  }, [id]);

  /* --- Autosave for existing sets ----------------------------------------- */

  const timers = useRef(new Map<string, number>());
  const schedule = useCallback((key: string, fn: () => Promise<unknown>) => {
    const existing = timers.current.get(key);
    if (existing) window.clearTimeout(existing);
    timers.current.set(
      key,
      window.setTimeout(() => {
        timers.current.delete(key);
        setSaving(true);
        fn()
          .catch(() => toast.error("Couldn't save"))
          .finally(() => setSaving(timers.current.size > 0));
      }, SAVE_DEBOUNCE_MS),
    );
  }, []);

  useEffect(() => {
    const map = timers.current;
    return () => map.forEach((t) => window.clearTimeout(t));
  }, []);

  const updateMeta = (patch: { title?: string; description?: string }) => {
    if (patch.title !== undefined) setTitle(patch.title);
    if (patch.description !== undefined) setDescription(patch.description);
    setDirty(true);
    if (id) schedule("meta", () => setsRepo.update(id, patch));
  };

  const updateRow = (key: string, patch: Partial<DraftTerm>) => {
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, ...patch } : r)));
    setDirty(true);
    if (!id) return;
    const row = rows.find((r) => r.key === key);
    if (!row?.termId) return;
    const termId = row.termId;
    const next = { ...row, ...patch };
    schedule(`term:${key}`, () =>
      termsRepo.update(termId, { term: next.term, definition: next.definition, imageBlobId: next.imageBlobId }),
    );
  };

  const addRow = async (afterKey?: string) => {
    const draft = blank();
    if (id) {
      const created = await termsRepo.add(id, "", "");
      draft.termId = created.id;
      draft.key = created.id;
    }
    setRows((prev) => {
      const at = afterKey ? prev.findIndex((r) => r.key === afterKey) + 1 : prev.length;
      const next = prev.slice();
      next.splice(at || prev.length, 0, draft);
      if (id) void termsRepo.reorder(id, next.filter((r) => r.termId).map((r) => r.termId!));
      return next;
    });
    setFocusKey(draft.key);
    setDirty(true);
  };

  const removeRow = async (key: string) => {
    const row = rows.find((r) => r.key === key);
    setRows((prev) => (prev.length > 1 ? prev.filter((r) => r.key !== key) : prev));
    setDirty(true);
    if (id && row?.termId) await termsRepo.remove(row.termId);
  };

  const reorder = (next: DraftTerm[]) => {
    setRows(next);
    setDirty(true);
    if (id) schedule("order", () => termsRepo.reorder(id, next.filter((r) => r.termId).map((r) => r.termId!)));
  };

  const move = (key: string, delta: number) => {
    const from = rows.findIndex((r) => r.key === key);
    const to = from + delta;
    if (from < 0 || to < 0 || to >= rows.length) return;
    const next = rows.slice();
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item);
    reorder(next);
  };

  const importRows = async (imported: { term: string; definition: string }[]) => {
    if (!imported.length) return;
    let drafts: DraftTerm[] = imported.map((r) => ({ ...blank(), term: r.term, definition: r.definition }));
    if (id) {
      const created = await termsRepo.addMany(id, imported);
      drafts = created.map((t) => ({ key: t.id, termId: t.id, term: t.term, definition: t.definition, imageBlobId: null }));
    }
    setRows((prev) => {
      const keep = prev.filter((r) => r.term.trim() || r.definition.trim());
      return [...keep, ...drafts];
    });
    setDirty(true);
    toast.success(`Imported ${imported.length} ${imported.length === 1 ? "card" : "cards"}`);
  };

  /* --- Create ---------------------------------------------------------------- */

  const create = async () => {
    const filled = rows.filter((r) => r.term.trim() || r.definition.trim());
    if (!title.trim()) {
      toast.error("Give your set a title");
      return;
    }
    if (filled.length < 1) {
      toast.error("Add at least one term");
      return;
    }
    setSaving(true);
    try {
      const set = await setsRepo.create({ title: title.trim(), description: description.trim() });
      const created = await termsRepo.addMany(
        set.id,
        filled.map((r) => ({ term: r.term.trim(), definition: r.definition.trim() })),
      );
      await Promise.all(
        created.map((t, i) => (filled[i].imageBlobId ? termsRepo.update(t.id, { imageBlobId: filled[i].imageBlobId }) : null)),
      );
      setDirty(false);
      router.push(routes.set(set.id));
    } catch {
      toast.error("Couldn't create the set");
      setSaving(false);
    }
  };

  const done = () => {
    if (id && !title.trim()) {
      toast.error("Give your set a title");
      return;
    }
    if (id) router.push(routes.set(id));
  };

  /* Warn before leaving a brand-new set with unsaved work. */
  useEffect(() => {
    if (id || !dirty) return;
    const onLeave = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener("beforeunload", onLeave);
    return () => window.removeEventListener("beforeunload", onLeave);
  }, [id, dirty]);

  if (status === "loading") {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Spinner size={32} />
      </div>
    );
  }
  if (status === "missing") {
    return (
      <EmptyState
        title="We couldn't find that set"
        actions={
          <NavButton href={routes.create}>Create a new set</NavButton>
        }
      />
    );
  }

  const filledCount = rows.filter((r) => r.term.trim() || r.definition.trim()).length;

  return (
    <motion.main
      variants={stagger(0.05)}
      initial="hidden"
      animate="show"
      className="mx-auto w-full max-w-[1000px] px-4 pb-32 pt-8 md:px-8 md:pt-10"
    >
      <motion.header variants={riseIn} className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-[26px] leading-tight md:text-[32px]">{id ? "Edit set" : "Create a new set"}</h1>
          {id && (
            <p className="mt-1 text-[13px] font-semibold text-[var(--text-muted)]" aria-live="polite">
              {saving ? "Saving…" : "All changes saved"}
            </p>
          )}
        </div>
        <Button onClick={id ? done : create} disabled={saving && !id}>
          {id ? "Done" : "Create"}
        </Button>
      </motion.header>

      <motion.section variants={riseIn} className="mt-6 flex flex-col gap-6">
        <div>
          <Input
            value={title}
            onChange={(e) => updateMeta({ title: e.target.value })}
            placeholder='Enter a title, like "Biology - Chapter 22: Evolution"'
            aria-label="Title"
            className="text-[20px] font-bold"
            autoFocus={!id}
          />
          <p className="mt-1.5 text-[11px] font-bold uppercase tracking-[0.08em] text-[var(--text-muted)]">Title</p>
        </div>
        <div>
          <Input
            value={description}
            onChange={(e) => updateMeta({ description: e.target.value })}
            placeholder="Add a description…"
            aria-label="Description"
          />
          <p className="mt-1.5 text-[11px] font-bold uppercase tracking-[0.08em] text-[var(--text-muted)]">Description</p>
        </div>
      </motion.section>

      <motion.div variants={riseIn} className="mt-8 flex items-center justify-between gap-3">
        <Button variant="secondary" size="sm" leading={<Import className="h-4 w-4" />} onClick={() => setImportOpen(true)}>
          Import
        </Button>
        <span className="text-[13px] font-semibold text-[var(--text-muted)]">
          {filledCount} {filledCount === 1 ? "card" : "cards"}
        </span>
      </motion.div>

      <Reorder.Group axis="y" values={rows} onReorder={reorder} as="ol" className="mt-4 flex flex-col gap-4">
        <AnimatePresence initial={false}>
          {rows.map((row, i) => (
            <TermCardEditor
              key={row.key}
              draft={row}
              index={i}
              count={rows.length}
              autoFocus={focusKey === row.key}
              onChange={(patch) => updateRow(row.key, patch)}
              onRemove={() => void removeRow(row.key)}
              onAddAfter={() => void addRow(row.key)}
              onMove={(delta) => move(row.key, delta)}
            />
          ))}
        </AnimatePresence>
      </Reorder.Group>

      <motion.button
        variants={riseIn}
        type="button"
        onClick={() => void addRow()}
        className="group mt-4 flex h-[92px] w-full items-center justify-center rounded-[8px] bg-[var(--surface)] shadow-[var(--shadow-sm)] transition-colors hover:bg-[var(--surface-2)]"
      >
        <span className="inline-flex items-center gap-2 border-b-[3px] border-[var(--brand)] pb-1 text-[15px] font-bold uppercase tracking-wide text-[var(--text)] transition-colors group-hover:border-[var(--star)] group-hover:text-[var(--brand)]">
          <Plus className="h-4 w-4" aria-hidden /> Add card
        </span>
      </motion.button>

      <div className="fixed inset-x-0 bottom-0 z-20 bg-[var(--bg)]/95 px-4 py-4 backdrop-blur md:hidden">
        <Button block onClick={id ? done : create}>
          {id ? "Done" : "Create"}
        </Button>
      </div>

      <ImportDialog open={importOpen} onClose={() => setImportOpen(false)} onImport={(r) => void importRows(r)} />
    </motion.main>
  );
}
