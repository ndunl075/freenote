# freenote — Architecture

Open-source, local-first note-taking + study app. One Notability-style interface across
both halves: the ink editor and the study modes share a single design language.
No accounts, no server, no telemetry. Everything lives in the browser on your device.

## Principles

1. **Local-first, always.** No network calls at runtime. IndexedDB is the source of truth.
2. **Static build.** Ships as pure static assets — hostable on Vercel, Pages, or a USB stick.
3. **60fps or it's a bug.** Ink and transitions run off the main-thread layout path.
4. **Data is yours.** Every note and set round-trips through a plain-JSON export.

## Stack

| Concern    | Choice                    | Why                                          |
| ---------- | ------------------------- | -------------------------------------------- |
| Framework  | Next.js (App Router)      | `output: 'export'` → static, Vercel-native    |
| Language   | TypeScript (strict)       | Ink + study engines are worth type-checking   |
| Styling    | Tailwind CSS + CSS vars   | Token-driven theming, light/dark              |
| Animation  | Framer Motion             | Shared-element + spring physics for study UI  |
| State      | Zustand                   | Small, sync, no provider tree                 |
| Storage    | Dexie (IndexedDB)         | Blobs (audio/images) + structured records     |
| Ink        | perfect-freehand + Canvas2D | Pressure-tapered variable-width strokes     |

## Design language

Notability's chrome is essentially clean iOS system UI with paper warmth, so the tokens lean
on iOS system colours: a calm `#007AFF` accent, warm neutral greys, neutral-charcoal dark
mode, hairline borders, generous corner radii, and soft shallow elevation. Buttons dim and
settle rather than bouncing. Type is Inter — the closest open stand-in for SF Pro — at
interface weights, never display weights.

The study modes use exactly these tokens. Nothing about the study half is styled
separately; a term card and a note card are the same object with different content.

## Routing

Static export can't prerender unknown ids, so ids ride in the query string.

```
/                       Library — subjects, notes, sets
/note?id=<noteId>       Note editor
/set?id=<setId>         Set detail
/create-set?id=<setId>  Set editor
/study?set=<id>&mode=…  flashcards | learn | test | match | blast
/settings               Theme, storage, import/export
```

## Layout

```
src/
  app/            routes (thin — shells that mount features)
  features/
    library/      subjects, dividers, note + set grids
    editor/       Notability canvas: toolbars, pages, tools
    study/        flashcards, learn, test, match, blast — each self-contained
    settings/     appearance, writing, studying, data
  lib/
    db/           Dexie schema, migrations, repositories
    ink/          stroke model, renderer, hit-test, eraser, lasso, recogniser
    study/        scheduler (SM-2-lite), question generator, grading
    media/        audio recorder, ink/audio sync
    io/           JSON backup, PDF/PNG export, note → set extraction
    motion/       shared spring presets + variants
  components/     ui/ primitives, plus menu, sheet, shell, paper, theme
```

Rule: `features/*` may import `lib/*` and `components/*`, never each other.

## Data model

```ts
Subject  { id, name, color, order }
Note     { id, subjectId, title, pages: PageId[], updatedAt }
Page     { id, noteId, index, paper, strokes: Stroke[], objects: NoteObject[] }
Stroke   { id, tool, color, size, points: [x,y,pressure][], bbox }
Recording{ id, noteId, blob, marks: [{ t, strokeId }] }   // audio ↔ ink sync

StudySet { id, title, subjectId?, termCount, updatedAt }
Term     { id, setId, front, back, image?, order, starred }
Progress { termId, box, streak, dueAt, lapses }           // per-mode SRS state
```

Everything keys off `id` (nanoid). No foreign-key cascades — repositories own cleanup.

## Ink pipeline

```
PointerEvent → coalesced points → predictive smoothing
             → perfect-freehand outline → Path2D
             → committed layer (static bitmap) + live layer (current stroke)
```

Three canvases per page: a **committed** layer redrawn only on mutation, a **live** layer
cleared each frame, and an **overlay** carrying the eraser cursor and lasso path. Erase and
lasso hit-test against stroke bboxes first, then segment distance. Undo is a bounded
inverse-command stack per page, ordered across pages so Cmd+Z always undoes the last edit.

Pages mount their canvases only when near the viewport; a long note otherwise holds tens of
megabytes of backing store it cannot see.

Holding the pen still at the end of a stroke runs the shape recogniser, which snaps rough
circles, boxes and lines to clean geometry — and returns null on anything it is not
confident about, since a false positive destroys work.

## Study engines

Each mode is a reducer over `(terms, progress, answer) → nextState`. Pure, testable,
UI-agnostic. Shared pieces: answer normalization (case/punct/accent-insensitive),
distractor selection, and the SM-2-lite box scheduler used by Learn.

| Mode       | Shape                                                      |
| ---------- | ---------------------------------------------------------- |
| Flashcards | 3D card flip, swipe-to-sort, autoplay                      |
| Learn      | Adaptive MC → written, round-based, mastery bars           |
| Test       | Generated exam: MC, true/false, written, matching          |
| Match      | Timed grid, drag-to-pair, leaderboard in local storage     |
| Blast      | Falling-term arcade mode                                   |

## Persistence

Writes are debounced and batched per page. Dexie transactions keep a note's pages and
strokes atomic. Schema version bumps ship a migration function; no migration ever drops
user data.

## Testing

- **Unit** (Vitest): ink geometry, study reducers, answer grading, import/export.
- **E2E** (Playwright): runs against the production static export, not a dev server, since
  "it is just static files" is the deployment story. Covers draw → persist → reload, undo,
  erase, the library, and every study mode.
- One E2E test asserts the app makes **no request to any host but localhost**, and CI fails
  the build if an API route is ever emitted. The privacy claim is enforced from both ends
  rather than documented.

## Non-goals

Accounts, sync, sharing, classes, social, analytics, paid tiers, server of any kind.
