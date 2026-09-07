/**
 * Paste-to-import parser for the set editor.
 *
 * Mirrors Quizlet's import dialog: pick what separates a term from its
 * definition (tab, comma, or anything) and what separates rows (newline,
 * semicolon, or anything). The first occurrence of the term separator splits
 * the row, so definitions can contain commas.
 */

export type TermSeparator = "tab" | "comma" | "custom";
export type RowSeparator = "newline" | "semicolon" | "custom";

export interface ImportOptions {
  termSeparator: TermSeparator;
  customTermSeparator: string;
  rowSeparator: RowSeparator;
  customRowSeparator: string;
}

export const DEFAULT_IMPORT_OPTIONS: ImportOptions = {
  termSeparator: "tab",
  customTermSeparator: " - ",
  rowSeparator: "newline",
  customRowSeparator: "\\n\\n",
};

export interface ImportedRow {
  term: string;
  definition: string;
}

/** Turn the escape sequences a user types into the characters they mean. */
export function unescapeSeparator(raw: string): string {
  return raw.replace(/\\n/g, "\n").replace(/\\t/g, "\t").replace(/\\r/g, "\r");
}

export function resolveTermSeparator(opts: ImportOptions): string {
  if (opts.termSeparator === "tab") return "\t";
  if (opts.termSeparator === "comma") return ",";
  return unescapeSeparator(opts.customTermSeparator);
}

export function resolveRowSeparator(opts: ImportOptions): string {
  if (opts.rowSeparator === "newline") return "\n";
  if (opts.rowSeparator === "semicolon") return ";";
  return unescapeSeparator(opts.customRowSeparator);
}

export function parseImport(text: string, opts: ImportOptions = DEFAULT_IMPORT_OPTIONS): ImportedRow[] {
  const termSep = resolveTermSeparator(opts);
  const rowSep = resolveRowSeparator(opts);
  if (!termSep || !rowSep) return [];

  const normalised = text.replace(/\r\n?/g, "\n");
  const rows = normalised.split(rowSep);
  const out: ImportedRow[] = [];

  for (const raw of rows) {
    const row = rowSep === "\n" ? raw : raw.trim();
    if (!row.trim()) continue;
    const at = row.indexOf(termSep);
    if (at === -1) {
      out.push({ term: row.trim(), definition: "" });
      continue;
    }
    const term = row.slice(0, at).trim();
    const definition = row.slice(at + termSep.length).trim();
    if (!term && !definition) continue;
    out.push({ term, definition });
  }
  return out;
}

/** Best guess at what a pasted block uses, so the dialog can preselect it. */
export function guessTermSeparator(text: string): TermSeparator {
  if (text.includes("\t")) return "tab";
  if (text.includes(",")) return "comma";
  return "tab";
}
