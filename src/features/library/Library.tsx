"use client";

import { Menu as MenuIcon } from "lucide-react";
import { useEffect, useMemo } from "react";
import { useBackupImport } from "@/components/backup/useBackupImport";
import { Sheet } from "@/components/sheet/Sheet";
import { AppShell } from "@/components/shell/AppShell";
import { IconButton } from "@/components/ui";
import { ContentGrid, GridSkeleton } from "./ContentGrid";
import { EmptyState } from "./EmptyState";
import { HomeHero } from "./HomeHero";
import { LibraryDialogs } from "./LibraryDialogs";
import { LibraryHeader, SEARCH_INPUT_ID } from "./LibraryHeader";
import { sectionKey, toItems, visibleItems } from "./logic";
import { useCreateActions } from "./NewMenu";
import { Sidebar } from "./Sidebar";
import { useLibrary } from "./store";

/**
 * The library route. Layout follows Notability: a subject rail on the left,
 * the current section's notes and sets on the right. On narrow screens the
 * rail folds into a slide-over sheet opened from the header.
 */
export function Library() {
  const ready = useLibrary((s) => s.ready);
  const load = useLibrary((s) => s.load);
  const notes = useLibrary((s) => s.notes);
  const sets = useLibrary((s) => s.sets);
  const subjects = useLibrary((s) => s.subjects);
  const mastery = useLibrary((s) => s.mastery);
  const section = useLibrary((s) => s.section);
  const query = useLibrary((s) => s.query);
  const setQuery = useLibrary((s) => s.setQuery);
  const sort = useLibrary((s) => s.sort);
  const view = useLibrary((s) => s.view);
  const sidebarOpen = useLibrary((s) => s.sidebarOpen);
  const setSidebarOpen = useLibrary((s) => s.setSidebarOpen);

  const importer = useBackupImport(() => void load());
  const create = useCreateActions();

  useEffect(() => {
    void load();
  }, [load]);

  // "/" jumps to search from anywhere on the page, like GitHub and Gmail.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "/" || e.metaKey || e.ctrlKey || e.altKey) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
      e.preventDefault();
      document.getElementById(SEARCH_INPUT_ID)?.focus();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  // The hero belongs on the landing view only: it is an invitation to start,
  // not a banner to sit above every filtered result.
  const showHero = ready && section.kind === "all" && query.trim() === "";

  const allItems = useMemo(() => toItems(notes, sets), [notes, sets]);
  const items = useMemo(
    () => visibleItems(allItems, { section, query, sort, subjects }),
    [allItems, section, query, sort, subjects],
  );

  return (
    <AppShell
      leading={
        <IconButton
          label="Open subjects"
          className="md:hidden"
          aria-haspopup="dialog"
          aria-expanded={sidebarOpen}
          onClick={() => setSidebarOpen(true)}
        >
          <MenuIcon />
        </IconButton>
      }
    >
      <div className="mx-auto flex w-full max-w-[1440px] flex-1">
        <aside
          className="sticky top-14 hidden h-[calc(100vh-56px)] w-[264px] shrink-0 overflow-y-auto border-r border-[var(--border-soft)] md:block"
          aria-label="Subjects"
        >
          <Sidebar />
        </aside>

        <Sheet open={sidebarOpen} onClose={() => setSidebarOpen(false)} label="Subjects">
          <div className="flex-1 overflow-y-auto">
            <Sidebar />
          </div>
        </Sheet>

        <section className="min-w-0 flex-1 px-4 pb-16 pt-5 sm:px-6 lg:px-8" aria-label="Library contents">
          {showHero && (
            <HomeHero
              seed={allItems.length}
              onNewNote={() => void create.newNote()}
              onRecord={() => void create.newRecording()}
              onNewSet={() => void create.newSet()}
              onImport={importer.pick}
            />
          )}

          <LibraryHeader count={items.length} onImport={importer.pick} />

          {!ready ? (
            <GridSkeleton view={view} />
          ) : items.length === 0 ? (
            <EmptyState
              section={section}
              query={query}
              subjects={subjects}
              libraryEmpty={allItems.length === 0}
              onNewNote={() => void create.newNote()}
              onNewSet={() => void create.newSet()}
              onImport={importer.pick}
              onClearSearch={() => setQuery("")}
            />
          ) : (
            <ContentGrid
              items={items}
              view={view}
              section={section}
              subjects={subjects}
              mastery={mastery}
              gridKey={`${sectionKey(section)}:${view}`}
            />
          )}
        </section>
      </div>

      <LibraryDialogs />
      {importer.element}
    </AppShell>
  );
}
