/* ============================================================================
   freenote data model

   Every record here lives in the user's browser (IndexedDB) and nowhere else.
   There are no user ids, no ownership fields, and no sync metadata, because
   there is no server to sync with.
   ========================================================================= */

export type ID = string;

/* --- Notes ---------------------------------------------------------------- */

export interface Subject {
  id: ID;
  name: string;
  /** Hex colour used for the divider tab and note accents. */
  color: string;
  /** Optional parent — Notability nests dividers one level under subjects. */
  parentId: ID | null;
  order: number;
  createdAt: number;
}

export type PaperStyle =
  | "blank"
  | "lined-narrow"
  | "lined-wide"
  | "grid"
  | "dotted"
  | "cornell"
  | "music";

export type PaperColor = "white" | "cream" | "yellow" | "gray" | "black";

export interface Note {
  id: ID;
  subjectId: ID | null;
  title: string;
  /** Ordered page ids. Pages are separate records so a page edit doesn't
   *  rewrite the whole note. */
  pageIds: ID[];
  paper: PaperStyle;
  paperColor: PaperColor;
  /** Data URL of a small canvas snapshot, rendered for the library grid. */
  thumbnail?: string;
  starred: boolean;
  createdAt: number;
  updatedAt: number;
}

/** A single ink stroke. Points are flat triples for compactness: strokes are
 *  the highest-volume record in the database by an order of magnitude. */
export interface Stroke {
  id: ID;
  tool: "pen" | "highlighter" | "marker";
  color: string;
  /** Base width in CSS pixels before pressure modulation. */
  size: number;
  opacity: number;
  /** [x, y, pressure, ...] — flat for storage and transfer efficiency. */
  points: number[];
  /** [minX, minY, maxX, maxY] — cached for O(1) hit-test rejection. */
  bbox: [number, number, number, number];
  /** ms offset into the note's recording, when one was active. */
  t?: number;
}

export type NoteObject =
  | {
      kind: "text";
      id: ID;
      x: number;
      y: number;
      width: number;
      html: string;
      fontSize: number;
      color: string;
    }
  | {
      kind: "image";
      id: ID;
      x: number;
      y: number;
      width: number;
      height: number;
      rotation: number;
      /** Key into the `blobs` table — images never live in the record itself. */
      blobId: ID;
    }
  | {
      kind: "shape";
      id: ID;
      shape: "rect" | "ellipse" | "line" | "arrow";
      x: number;
      y: number;
      width: number;
      height: number;
      color: string;
      strokeWidth: number;
      fill: string | null;
    }
  | {
      kind: "sticky";
      id: ID;
      x: number;
      y: number;
      width: number;
      height: number;
      text: string;
      color: string;
    };

export interface Page {
  id: ID;
  noteId: ID;
  index: number;
  /** Logical page height in CSS px. Notability pages grow as you write. */
  height: number;
  strokes: Stroke[];
  objects: NoteObject[];
}

/** Audio recorded alongside handwriting. `marks` lets playback replay the ink. */
export interface Recording {
  id: ID;
  noteId: ID;
  blobId: ID;
  durationMs: number;
  createdAt: number;
  /** Stroke id → ms offset, so scrubbing can highlight what was written when. */
  marks: { strokeId: ID; t: number }[];
}

export interface StoredBlob {
  id: ID;
  blob: Blob;
  mime: string;
  size: number;
  createdAt: number;
}

/* --- Study ---------------------------------------------------------------- */

export interface StudySet {
  id: ID;
  title: string;
  description: string;
  subjectId: ID | null;
  /** Set when generated from a note, so the set can link back to its source. */
  sourceNoteId: ID | null;
  termLanguage: string;
  definitionLanguage: string;
  starred: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface Term {
  id: ID;
  setId: ID;
  term: string;
  definition: string;
  /** Blob id for an optional image on the definition side. */
  imageBlobId: ID | null;
  order: number;
  starred: boolean;
}

export type StudyMode = "flashcards" | "learn" | "test" | "match" | "blast";

/**
 * Per-term scheduling state, shared by Flashcards and Learn.
 * `box` is an SM-2-lite Leitner box: 0 = never seen, 5 = mastered.
 */
export interface Progress {
  termId: ID;
  setId: ID;
  box: number;
  streak: number;
  lapses: number;
  seen: number;
  correct: number;
  dueAt: number;
  lastSeenAt: number;
  /** Learn tracks written vs multiple-choice mastery separately. */
  writtenCorrect: number;
  choiceCorrect: number;
}

/** Best times per set for Match, kept locally — no global leaderboard. */
export interface MatchRecord {
  id: ID;
  setId: ID;
  timeMs: number;
  termCount: number;
  achievedAt: number;
}

export interface StudySession {
  id: ID;
  setId: ID;
  mode: StudyMode;
  startedAt: number;
  endedAt: number | null;
  /** Mode-specific resumable state, serialised by the mode's reducer. */
  state: unknown;
}

/* --- App ------------------------------------------------------------------ */

export interface Settings {
  id: "settings";
  theme: "light" | "dark" | "system";
  /**
   * Whether a finger can lay down ink.
   *
   * Off by default. On a tablet a finger scrolls and a stylus draws, which is
   * the only arrangement that cannot mistake a resting palm for a deliberate
   * mark. Inferring it from contact size does not work: Safari reports no
   * touch contact geometry at all, and a palm usually lands *before* the pen
   * tip, so "a stylus has been seen" has not armed yet when it matters.
   */
  fingerDrawing: boolean;
  /** Scroll direction lock for the editor. */
  scrollLock: "vertical" | "horizontal";
  defaultPaper: PaperStyle;
  defaultPaperColor: PaperColor;
  /** Flashcards autoplay seconds per side. */
  autoplaySeconds: number;
  /** Answer grading strictness for Learn/Test written questions. */
  gradingStrictness: "lenient" | "strict";
  soundEnabled: boolean;
  lastOpenedNoteId: ID | null;
}

export const DEFAULT_SETTINGS: Settings = {
  id: "settings",
  theme: "system",
  fingerDrawing: false,
  scrollLock: "vertical",
  defaultPaper: "lined-wide",
  defaultPaperColor: "white",
  autoplaySeconds: 4,
  gradingStrictness: "lenient",
  soundEnabled: true,
  lastOpenedNoteId: null,
};

/* --- Export format -------------------------------------------------------- */

/** The shape of a `.freenote` backup file. Plain JSON with base64 blobs so a
 *  human can read it and a different tool can import it. */
export interface FreenoteExport {
  format: "freenote-export";
  version: 1;
  exportedAt: number;
  subjects: Subject[];
  notes: Note[];
  pages: Page[];
  recordings: Recording[];
  sets: StudySet[];
  terms: Term[];
  progress: Progress[];
  matchRecords: MatchRecord[];
  blobs: { id: ID; mime: string; data: string }[];
}
