import type { Note, NoteObject, Page } from "@/lib/db/types";

/* ============================================================================
   Turning a note into a study set.

   Handwriting can't be read without OCR, which would mean shipping a model or
   calling a service — the first is heavy, the second breaks the promise the
   whole app is built on. So this reads the text the note already holds as text:
   text boxes and sticky notes.

   That's a real limitation and the UI says so plainly rather than silently
   producing an empty set from a page of handwriting.
   ========================================================================= */

export interface ParsedRow {
  term: string;
  definition: string;
}

/** Separators recognised between a term and its definition, longest first. */
const SEPARATORS = [" — ", " – ", " -- ", ": ", " - ", "\t", "|"];

/** Strips HTML to text, preserving line structure from block tags. */
export function htmlToLines(html: string): string[] {
  const withBreaks = html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li|h[1-6])>/gi, "\n")
    .replace(/<[^>]+>/g, "");

  const decoded = withBreaks
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");

  return decoded
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
}

/** Splits one line into term and definition, or returns null if it can't. */
export function parseLine(line: string): ParsedRow | null {
  for (const sep of SEPARATORS) {
    const at = line.indexOf(sep);
    // Require content on both sides — a line starting with a dash is a bullet,
    // not a term with an empty definition.
    if (at > 0 && at + sep.length < line.length) {
      const term = line.slice(0, at).trim();
      const definition = line.slice(at + sep.length).trim();
      if (term && definition) return { term, definition };
    }
  }
  return null;
}

function textOf(object: NoteObject): string[] {
  if (object.kind === "text") return htmlToLines(object.html);
  if (object.kind === "sticky") {
    return object.text.split("\n").map((l) => l.trim()).filter(Boolean);
  }
  return [];
}

/**
 * Extracts term/definition pairs from every text object in a note, in reading
 * order: page by page, then top to bottom, then left to right.
 */
export function rowsFromNote(pages: Page[]): ParsedRow[] {
  const rows: ParsedRow[] = [];

  for (const page of [...pages].sort((a, b) => a.index - b.index)) {
    const ordered = [...page.objects].sort((a, b) => a.y - b.y || a.x - b.x);
    for (const object of ordered) {
      for (const line of textOf(object)) {
        const row = parseLine(line);
        if (row) rows.push(row);
      }
    }
  }

  // Later definitions win: someone correcting a term further down the page
  // meant the correction.
  const seen = new Map<string, ParsedRow>();
  for (const row of rows) seen.set(row.term.toLowerCase(), row);
  return [...seen.values()];
}

/** How many cards a note would yield, for the menu's preview label. */
export function countableRows(pages: Page[]): number {
  return rowsFromNote(pages).length;
}

export function setTitleFor(note: Note): string {
  const base = note.title.trim();
  return base && base !== "Untitled note" ? base : "Study set";
}
