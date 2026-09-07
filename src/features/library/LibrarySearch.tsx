"use client";

import { Search, X } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { useLibrary } from "./store";

export const SEARCH_INPUT_ID = "library-search";

/** Search lives at the top of the sidebar, above the section list, where
 *  Notability keeps it — next to what it filters rather than over the grid. */
export function LibrarySearch() {
  const query = useLibrary((s) => s.query);
  const setQuery = useLibrary((s) => s.setQuery);

  return (
    <form
      role="search"
      onSubmit={(e) => e.preventDefault()}
      className="relative"
    >
      <Search
        aria-hidden
        className="pointer-events-none absolute left-3 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-[var(--text-faint)]"
      />
      <input
        id={SEARCH_INPUT_ID}
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Escape" && query) {
            e.preventDefault();
            setQuery("");
          }
        }}
        placeholder="Search notes and sets"
        aria-label="Search notes and sets by title"
        autoComplete="off"
        className={cn(
          "h-10 w-full rounded-[10px] border border-[var(--border)] bg-[var(--surface)] pl-10 pr-10",
          "text-[15px] text-[var(--text)] placeholder:text-[var(--text-faint)]",
          "outline-none transition-colors focus:border-[var(--brand)]",
          "[&::-webkit-search-cancel-button]:hidden",
        )}
      />
      {query && (
        <button
          type="button"
          onClick={() => setQuery("")}
          aria-label="Clear search"
          className="absolute right-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full text-[var(--text-muted)] hover:bg-[var(--surface-2)] hover:text-[var(--text)]"
        >
          <X className="h-4 w-4" />
        </button>
      )}
      <kbd
        aria-hidden
        className={cn(
          "pointer-events-none absolute right-3.5 top-1/2 hidden -translate-y-1/2 rounded-[5px] border border-[var(--border)]",
          "px-1.5 py-0.5 font-sans text-[11px] font-bold text-[var(--text-faint)] md:block",
          query && "md:hidden",
        )}
      >
        /
      </kbd>
    </form>
  );
}
