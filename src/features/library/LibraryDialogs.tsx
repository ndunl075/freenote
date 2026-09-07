"use client";

import { Check, Inbox } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useFocusOnOpen } from "@/components/focus/useFocusOnOpen";
import { BoxInput, Button, Dialog } from "@/components/ui";
import type { Subject } from "@/lib/db";
import { cn } from "@/lib/utils/cn";
import { pluralize } from "@/lib/utils/format";
import { deleteItem, deleteSubject, moveItemToSubject, renameItem } from "./actions";
import { subjectTree, type LibraryItem } from "./logic";
import { useLibrary, type LibraryDialog } from "./store";

/**
 * Every modal the library opens, driven by `store.dialog`. Keeping them in
 * one place means a card's ⋯ menu only has to set a value — no prop drilling
 * of six callbacks through the grid.
 */
export function LibraryDialogs() {
  const dialog = useLibrary((s) => s.dialog);
  const setDialog = useLibrary((s) => s.setDialog);
  const subjects = useLibrary((s) => s.subjects);
  const close = useCallback(() => setDialog(null), [setDialog]);

  // Keep the last dialog around while it animates out, otherwise the content
  // vanishes a frame before the panel does.
  const [shown, setShown] = useState<LibraryDialog>(null);
  useEffect(() => {
    if (dialog) {
      const id = requestAnimationFrame(() => setShown(dialog));
      return () => cancelAnimationFrame(id);
    }
  }, [dialog]);
  const current = dialog ?? shown;

  return (
    <>
      <RenameDialog
        item={current?.kind === "rename" ? current.item : null}
        open={dialog?.kind === "rename"}
        onClose={close}
      />
      <MoveDialog
        item={current?.kind === "move" ? current.item : null}
        subjects={subjects}
        open={dialog?.kind === "move"}
        onClose={close}
      />
      <DeleteItemDialog
        item={current?.kind === "delete" ? current.item : null}
        open={dialog?.kind === "delete"}
        onClose={close}
      />
      <DeleteSubjectDialog
        subject={current?.kind === "delete-subject" ? current.subject : null}
        subjects={subjects}
        open={dialog?.kind === "delete-subject"}
        onClose={close}
      />
    </>
  );
}

/* --- Rename --------------------------------------------------------------- */

function RenameDialog({
  item,
  open,
  onClose,
}: {
  item: LibraryItem | null;
  open: boolean;
  onClose: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open || !item) return;
    // Seed the field from the item on open; select-all so typing replaces.
    const id = requestAnimationFrame(() => {
      setValue(item.title);
      inputRef.current?.focus();
      inputRef.current?.select();
    });
    return () => cancelAnimationFrame(id);
  }, [open, item]);

  const submit = async () => {
    if (!item || busy) return;
    setBusy(true);
    try {
      await renameItem(item, value);
      onClose();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      width="sm"
      title={item?.kind === "set" ? "Rename study set" : "Rename note"}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={busy || !value.trim()}>
            Save
          </Button>
        </>
      }
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        <label htmlFor="rename-item" className="mb-1.5 block text-[13px] font-bold text-[var(--text-muted)]">
          Title
        </label>
        <BoxInput
          id="rename-item"
          ref={inputRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          maxLength={200}
          autoComplete="off"
        />
      </form>
    </Dialog>
  );
}

/* --- Move ----------------------------------------------------------------- */

function MoveDialog({
  item,
  subjects,
  open,
  onClose,
}: {
  item: LibraryItem | null;
  subjects: Subject[];
  open: boolean;
  onClose: () => void;
}) {
  const tree = subjectTree(subjects);
  const listRef = useRef<HTMLUListElement>(null);
  const choose = async (subjectId: string | null) => {
    if (!item) return;
    onClose();
    await moveItemToSubject(item, subjectId);
  };

  useEffect(() => {
    if (!open) return;
    const id = requestAnimationFrame(() => {
      const list = listRef.current;
      (list?.querySelector<HTMLElement>('[aria-current="true"]') ?? list?.querySelector("button"))?.focus();
    });
    return () => cancelAnimationFrame(id);
  }, [open]);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      width="sm"
      title={item ? `Move “${item.title}”` : "Move"}
      description="Pick a subject or divider. The current location is highlighted."
    >
      <ul ref={listRef} role="list" className="-mx-1 max-h-[50vh] overflow-y-auto">
        <MoveRow id={null} name="Unfiled" depth={0} current={item?.subjectId === null} onChoose={choose} />
        {tree.map((node) => (
          <li key={node.subject.id}>
            <ul role="list">
              <MoveRow
                id={node.subject.id}
                name={node.subject.name}
                color={node.subject.color}
                depth={0}
                current={item?.subjectId === node.subject.id}
                onChoose={choose}
              />
              {node.dividers.map((d) => (
                <MoveRow
                  key={d.id}
                  id={d.id}
                  name={d.name}
                  color={d.color}
                  depth={1}
                  current={item?.subjectId === d.id}
                  onChoose={choose}
                />
              ))}
            </ul>
          </li>
        ))}
      </ul>
      {tree.length === 0 && (
        <p className="mt-3 text-[13px] text-[var(--text-muted)]">
          You haven&apos;t made any subjects yet — add one from the sidebar.
        </p>
      )}
    </Dialog>
  );
}

function MoveRow({
  id,
  name,
  color,
  depth,
  current,
  onChoose,
}: {
  id: string | null;
  name: string;
  color?: string;
  depth: 0 | 1;
  current: boolean;
  onChoose: (id: string | null) => void;
}) {
  return (
    <li>
      <button
        type="button"
        onClick={() => onChoose(id)}
        aria-current={current ? "true" : undefined}
        className={cn(
          "flex h-10 w-full items-center gap-2.5 rounded-[8px] pr-3 text-left text-[14px] font-semibold",
          depth === 1 ? "pl-9" : "pl-3",
          current
            ? "bg-[var(--brand-soft)] text-[var(--brand)]"
            : "text-[var(--text)] hover:bg-[var(--surface-2)]",
        )}
      >
        {color ? (
          <span
            aria-hidden
            className={cn("shrink-0", depth === 0 ? "h-3.5 w-3.5 rounded-[3px]" : "h-2.5 w-2.5 rounded-full")}
            style={{ background: color }}
          />
        ) : (
          <Inbox aria-hidden className="h-4 w-4 shrink-0 text-[var(--text-muted)]" />
        )}
        <span className="flex-1 truncate">{name}</span>
        {current && <Check aria-hidden className="h-4 w-4" />}
      </button>
    </li>
  );
}

/* --- Delete item ---------------------------------------------------------- */

function DeleteItemDialog({
  item,
  open,
  onClose,
}: {
  item: LibraryItem | null;
  open: boolean;
  onClose: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const cancelRef = useRef<HTMLButtonElement>(null);
  useFocusOnOpen(open, cancelRef);
  const confirm = async () => {
    if (!item || busy) return;
    setBusy(true);
    try {
      await deleteItem(item);
      onClose();
    } finally {
      setBusy(false);
    }
  };
  const what =
    item?.kind === "set"
      ? "This study set, its terms, and any study progress will be permanently deleted."
      : `This note and ${item ? pluralize(item.note.pageIds.length, "page") : "its pages"} will be permanently deleted.`;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      width="sm"
      title={item ? `Delete “${item.title}”?` : "Delete?"}
      description={`${what} There's no undo — freenote keeps everything on this device only.`}
      footer={
        <>
          <Button ref={cancelRef} variant="ghost" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button variant="danger" onClick={confirm} disabled={busy}>
            Delete
          </Button>
        </>
      }
    />
  );
}

/* --- Delete subject ------------------------------------------------------- */

function DeleteSubjectDialog({
  subject,
  subjects,
  open,
  onClose,
}: {
  subject: Subject | null;
  subjects: Subject[];
  open: boolean;
  onClose: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const cancelRef = useRef<HTMLButtonElement>(null);
  useFocusOnOpen(open, cancelRef);
  const dividers = subject ? subjects.filter((s) => s.parentId === subject.id).length : 0;
  const confirm = async () => {
    if (!subject || busy) return;
    setBusy(true);
    try {
      await deleteSubject(subject);
      onClose();
    } finally {
      setBusy(false);
    }
  };
  const kind = subject?.parentId ? "divider" : "subject";

  return (
    <Dialog
      open={open}
      onClose={onClose}
      width="sm"
      title={subject ? `Delete ${subject.name}?` : "Delete?"}
      description={
        <>
          Notes and sets in this {kind}
          {dividers > 0 ? ` and its ${pluralize(dividers, "divider")}` : ""} won&apos;t be deleted —
          they&apos;ll move to <strong className="text-[var(--text)]">Unfiled</strong>.
        </>
      }
      footer={
        <>
          <Button ref={cancelRef} variant="ghost" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button variant="danger" onClick={confirm} disabled={busy}>
            Delete {kind}
          </Button>
        </>
      }
    />
  );
}
