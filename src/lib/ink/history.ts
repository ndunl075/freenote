import type { NoteObject, Page, Stroke } from "@/lib/db/types";

/* ============================================================================
   Undo / redo

   Commands are inverse-encoded rather than snapshot-based: storing a full page
   copy per stroke would put a multi-megabyte history behind every note. Each
   command carries just enough to undo and redo itself.
   ========================================================================= */

export type Command =
  | { kind: "add-strokes"; strokes: Stroke[] }
  | { kind: "remove-strokes"; strokes: Stroke[] }
  | { kind: "move"; strokeIds: string[]; objectIds: string[]; dx: number; dy: number }
  | { kind: "add-object"; object: NoteObject }
  | { kind: "remove-object"; object: NoteObject }
  | { kind: "update-object"; before: NoteObject; after: NoteObject };

const MAX_DEPTH = 200;

export class History {
  private undoStack: Command[] = [];
  private redoStack: Command[] = [];

  get canUndo(): boolean {
    return this.undoStack.length > 0;
  }

  get canRedo(): boolean {
    return this.redoStack.length > 0;
  }

  /** Records a command that has already been applied. */
  push(command: Command): void {
    this.undoStack.push(command);
    if (this.undoStack.length > MAX_DEPTH) this.undoStack.shift();
    // Any new edit invalidates the redo branch.
    this.redoStack.length = 0;
  }

  undo(page: Page): Page | null {
    const command = this.undoStack.pop();
    if (!command) return null;
    this.redoStack.push(command);
    return apply(page, invert(command));
  }

  redo(page: Page): Page | null {
    const command = this.redoStack.pop();
    if (!command) return null;
    this.undoStack.push(command);
    return apply(page, command);
  }

  clear(): void {
    this.undoStack.length = 0;
    this.redoStack.length = 0;
  }
}

export function invert(command: Command): Command {
  switch (command.kind) {
    case "add-strokes":
      return { kind: "remove-strokes", strokes: command.strokes };
    case "remove-strokes":
      return { kind: "add-strokes", strokes: command.strokes };
    case "move":
      return { ...command, dx: -command.dx, dy: -command.dy };
    case "add-object":
      return { kind: "remove-object", object: command.object };
    case "remove-object":
      return { kind: "add-object", object: command.object };
    case "update-object":
      return { kind: "update-object", before: command.after, after: command.before };
  }
}

export function apply(page: Page, command: Command): Page {
  switch (command.kind) {
    case "add-strokes":
      return { ...page, strokes: [...page.strokes, ...command.strokes] };

    case "remove-strokes": {
      const ids = new Set(command.strokes.map((s) => s.id));
      return { ...page, strokes: page.strokes.filter((s) => !ids.has(s.id)) };
    }

    case "move": {
      const strokeIds = new Set(command.strokeIds);
      const objectIds = new Set(command.objectIds);
      return {
        ...page,
        strokes: page.strokes.map((s) =>
          strokeIds.has(s.id) ? shiftStroke(s, command.dx, command.dy) : s,
        ),
        objects: page.objects.map((o) =>
          objectIds.has(o.id) ? { ...o, x: o.x + command.dx, y: o.y + command.dy } : o,
        ),
      };
    }

    case "add-object":
      return { ...page, objects: [...page.objects, command.object] };

    case "remove-object":
      return { ...page, objects: page.objects.filter((o) => o.id !== command.object.id) };

    case "update-object":
      return {
        ...page,
        objects: page.objects.map((o) => (o.id === command.after.id ? command.after : o)),
      };
  }
}

function shiftStroke(stroke: Stroke, dx: number, dy: number): Stroke {
  const points = stroke.points.slice();
  for (let i = 0; i < points.length; i += 3) {
    points[i] += dx;
    points[i + 1] += dy;
  }
  return {
    ...stroke,
    points,
    bbox: [
      stroke.bbox[0] + dx,
      stroke.bbox[1] + dy,
      stroke.bbox[2] + dx,
      stroke.bbox[3] + dy,
    ],
  };
}
