"use client";

import { ArrowUpDown, LayoutGrid, List } from "lucide-react";
import { Menu, useMenu, type MenuEntry } from "@/components/menu/Menu";
import { Segmented } from "@/components/ui";
import { cn } from "@/lib/utils/cn";
import { pluralize } from "@/lib/utils/format";
import { NewMenu } from "./NewMenu";
import { sectionTitle, SORT_LABELS, type SortKey, type ViewMode } from "./logic";
import { SEARCH_INPUT_ID } from "./LibrarySearch";
import { useLibrary } from "./store";

export { SEARCH_INPUT_ID };

const SORT_KEYS: SortKey[] = ["updated", "title", "created"];

export function LibraryHeader({ count, onImport }: { count: number; onImport: () => void }) {
  const section = useLibrary((s) => s.section);
  const subjects = useLibrary((s) => s.subjects);
  const query = useLibrary((s) => s.query);
  const sort = useLibrary((s) => s.sort);
  const setSort = useLibrary((s) => s.setSort);
  const view = useLibrary((s) => s.view);
  const setView = useLibrary((s) => s.setView);
  const ready = useLibrary((s) => s.ready);

  const sortMenu = useMenu();
  const sortItems: MenuEntry[] = SORT_KEYS.map((key) => ({
    id: key,
    label: SORT_LABELS[key],
    checked: key === sort,
    onSelect: () => setSort(key),
  }));

  const title = sectionTitle(section, subjects);
  const subject = section.kind === "subject" ? subjects.find((s) => s.id === section.id) : undefined;

  return (
    <header className="mb-5 flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <h1 className="flex items-center gap-2.5 truncate text-[26px] leading-tight sm:text-[30px]">
            {subject && (
              <span
                aria-hidden
                className="h-[18px] w-[18px] shrink-0 rounded-[5px]"
                style={{ background: subject.color }}
              />
            )}
            <span className="truncate">{title}</span>
          </h1>
          <p className="mt-0.5 text-[13px] font-medium text-[var(--text-muted)]" aria-live="polite">
            {ready ? (query ? `${pluralize(count, "match", "matches")}` : pluralize(count, "item")) : " "}
          </p>
        </div>
        <NewMenu onImport={onImport} />
      </div>

      <div className="flex flex-wrap items-center gap-2 sm:gap-3">

        <div className="ml-auto flex items-center gap-2">
          <Segmented<ViewMode>
            id="library-view"
            value={view}
            onChange={setView}
            options={[
              { value: "grid", label: "Grid", icon: <LayoutGrid aria-hidden className="h-4 w-4" /> },
              { value: "list", label: "List", icon: <List aria-hidden className="h-4 w-4" /> },
            ]}
          />
          <button
            type="button"
            {...sortMenu.triggerProps}
            title={query ? "Search results are ranked by relevance" : undefined}
            className={cn(
              "inline-flex h-10 items-center gap-2 rounded-full bg-[var(--surface-2)] px-3.5 text-[14px] font-bold",
              "text-[var(--text)] transition-[background-color,opacity] hover:bg-[var(--surface-3)]",
              query && "opacity-60",
            )}
          >
            <ArrowUpDown aria-hidden className="h-4 w-4 text-[var(--text-muted)]" />
            <span className="sr-only">Sort by </span>
            <span className="hidden sm:inline">{SORT_LABELS[sort]}</span>
            <span className="sm:hidden">Sort</span>
          </button>
          <Menu
            open={sortMenu.open}
            onClose={sortMenu.close}
            anchorRef={sortMenu.anchorRef}
            items={sortItems}
            label="Sort by"
          />
        </div>
      </div>
    </header>
  );
}
