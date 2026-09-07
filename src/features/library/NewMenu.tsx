"use client";

import { ChevronDown, FilePlus2, Layers, Plus, Upload } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Menu, useMenu, type MenuEntry } from "@/components/menu/Menu";
import { Button, toast } from "@/components/ui";
import { createNote, createSet } from "./actions";
import { sectionSubjectId, sectionTitle } from "./logic";
import { useLibrary } from "./store";

/**
 * The library's primary action. Notes and sets created here are filed under
 * whichever subject is open, then the editor route takes over.
 */
export function NewMenu({ onImport }: { onImport: () => void }) {
  const router = useRouter();
  const menu = useMenu();
  const section = useLibrary((s) => s.section);
  const subjects = useLibrary((s) => s.subjects);
  const [busy, setBusy] = useState(false);

  const subjectId = sectionSubjectId(section);
  const where = subjectId ? `in ${sectionTitle(section, subjects)}` : undefined;

  const run = async (fn: () => Promise<string>) => {
    if (busy) return;
    setBusy(true);
    try {
      router.push(await fn());
    } catch {
      toast.error("Couldn't create that — is storage full?");
    } finally {
      setBusy(false);
    }
  };

  const items: MenuEntry[] = [
    {
      id: "note",
      label: "New note",
      hint: where,
      icon: <FilePlus2 />,
      onSelect: () =>
        void run(async () => `/note?id=${encodeURIComponent((await createNote(subjectId)).id)}`),
    },
    {
      id: "set",
      label: "New study set",
      hint: where,
      icon: <Layers />,
      onSelect: () =>
        void run(async () => `/set?id=${encodeURIComponent((await createSet(subjectId)).id)}`),
    },
    { id: "sep", separator: true },
    { id: "import", label: "Import backup…", icon: <Upload />, onSelect: onImport },
  ];

  return (
    <>
      <Button
        size="md"
        disabled={busy}
        leading={<Plus className="h-[18px] w-[18px]" aria-hidden />}
        trailing={<ChevronDown className="-mr-1 h-4 w-4 opacity-80" aria-hidden />}
        {...menu.triggerProps}
        className="pl-4 pr-3"
      >
        New
      </Button>
      <Menu open={menu.open} onClose={menu.close} anchorRef={menu.anchorRef} items={items} label="Create" />
    </>
  );
}

/** Direct handlers for the empty states, which skip the menu. */
export function useCreateActions() {
  const router = useRouter();
  const section = useLibrary((s) => s.section);
  const subjectId = sectionSubjectId(section);
  return {
    newNote: async () => {
      const note = await createNote(subjectId);
      router.push(`/note?id=${encodeURIComponent(note.id)}`);
    },
    newSet: async () => {
      const set = await createSet(subjectId);
      router.push(`/set?id=${encodeURIComponent(set.id)}`);
    },
    /** New note that starts recording as soon as the editor opens. */
    newRecording: async () => {
      const note = await createNote(subjectId);
      router.push(`/note?id=${encodeURIComponent(note.id)}&record=1`);
    },
  };
}
