# freenote — Architecture

Open-source, local-first note-taking + study app. Notability's editor, Quizlet's study UI.
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

## Routing

Static export can't prerender unknown ids, so ids ride in the query string.

```
/                       Library — subjects, notes, sets
/note?id=<noteId>       Note editor
/set?id=<setId>         Set detail
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
    study/        Quizlet modes, each self-contained
  lib/
    db/           Dexie schema, migrations, repositories
    ink/          stroke model, renderer, hit-test, eraser, lasso
    study/        scheduler (SM-2-lite), question generator, grading
    media/        audio recorder, image pipeline
    io/           JSON import/export, PDF/PNG rendering
    motion/       shared spring presets + variants
  components/ui/  primitives (Button, Sheet, Dialog, Toast)
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

Two canvases per page: a **committed** layer redrawn only on mutation, and a **live**
layer cleared each frame. Erase and lasso hit-test against stroke bboxes first, then
segment distance. Undo is a bounded command stack per note.

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
- **E2E** (Playwright): draw → persist → reload; run each study mode end to end.

## Non-goals

Accounts, sync, sharing, classes, social, analytics, paid tiers, server of any kind.
