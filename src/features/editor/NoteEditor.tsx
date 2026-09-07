"use client";

import { AnimatePresence, motion } from "framer-motion";
import { FileText, Minus, Plus, Trash2, ZoomIn } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button, FullPageSpinner, IconButton, Tooltip, toast } from "@/components/ui";
import { PAGE_WIDTH, blobs, notes as notesRepo } from "@/lib/db";
import { renderThumbnail } from "@/lib/io/exportNote";
import { PAPER_COLORS, PAPER_STYLES, STICKY_COLORS, defaultInkFor } from "@/lib/ink";
import { spring } from "@/lib/motion/springs";
import { newId } from "@/lib/utils/id";
import { cn } from "@/lib/utils/cn";
import { clearTouches } from "./gestures";
import { PageNavigator } from "./PageNavigator";
import { PageSlot } from "./PageSlot";
import { RecordingBar } from "./RecordingBar";
import { Toolbar } from "./Toolbar";
import { useEditor } from "./store";

const MIN_WIDTH = 320;

export function NoteEditor({
  noteId,
  onBack,
  autoRecord = false,
}: {
  noteId: string;
  onBack: () => void;
  /** Opened from "Record a lecture" — start capturing as soon as we are ready. */
  autoRecord?: boolean;
}) {
  const load = useEditor((s) => s.load);
  const close = useEditor((s) => s.close);
  const loading = useEditor((s) => s.loading);
  const note = useEditor((s) => s.note);
  const pages = useEditor((s) => s.pages);
  const zoom = useEditor((s) => s.zoom);
  const setZoom = useEditor((s) => s.setZoom);
  const tool = useEditor((s) => s.tool);
  const undo = useEditor((s) => s.undo);
  const redo = useEditor((s) => s.redo);
  const addPage = useEditor((s) => s.addPage);
  const removePage = useEditor((s) => s.removePage);
  const setTool = useEditor((s) => s.setTool);
  const addObject = useEditor((s) => s.addObject);
  const deleteSelection = useEditor((s) => s.deleteSelection);
  const flush = useEditor((s) => s.flush);

  const scrollRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [paperOpen, setPaperOpen] = useState(false);

  useEffect(() => {
    void load(noteId);
    return () => close();
  }, [noteId, load, close]);

  /* --- Pinch to zoom, and one finger to pan with the hand tool --------------
     The canvas takes single-finger touches for drawing, so the scroller only
     claims a touch when it is the second one (a pinch) or when the hand tool
     is active. Zoom is anchored on the midpoint between the fingers so the
     page grows around what you are looking at rather than the top-left. */
  const pinchRef = useRef<{
    pointers: Map<number, { x: number; y: number }>;
    startDistance: number;
    startZoom: number;
    startScroll: { left: number; top: number };
    startMid: { x: number; y: number };
  } | null>(null);

  const onScrollerPointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (e.pointerType !== "touch") return;
      const el = scrollRef.current;
      if (!el) return;

      const g = pinchRef.current ?? {
        pointers: new Map<number, { x: number; y: number }>(),
        startDistance: 0,
        startZoom: zoom,
        startScroll: { left: el.scrollLeft, top: el.scrollTop },
        startMid: { x: 0, y: 0 },
      };
      g.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

      if (g.pointers.size === 2) {
        const [a, b] = [...g.pointers.values()];
        g.startDistance = Math.hypot(a.x - b.x, a.y - b.y);
        g.startZoom = zoom;
        g.startScroll = { left: el.scrollLeft, top: el.scrollTop };
        g.startMid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      }
      pinchRef.current = g;
    },
    [zoom],
  );

  const onScrollerPointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (e.pointerType !== "touch") return;
      const g = pinchRef.current;
      const el = scrollRef.current;
      if (!g || !el || !g.pointers.has(e.pointerId)) return;

      const previous = g.pointers.get(e.pointerId)!;
      g.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

      // One finger with the hand tool pans the page directly.
      if (g.pointers.size === 1) {
        if (tool !== "hand") return;
        el.scrollLeft -= e.clientX - previous.x;
        el.scrollTop -= e.clientY - previous.y;
        return;
      }

      if (g.pointers.size !== 2 || g.startDistance === 0) return;
      const [a, b] = [...g.pointers.values()];
      const distance = Math.hypot(a.x - b.x, a.y - b.y);
      const next = Math.min(4, Math.max(0.25, (g.startZoom * distance) / g.startDistance));

      // Keep the point between the fingers under the fingers as scale changes.
      const growth = next / g.startZoom;
      el.scrollLeft = (g.startScroll.left + g.startMid.x) * growth - g.startMid.x;
      el.scrollTop = (g.startScroll.top + g.startMid.y) * growth - g.startMid.y;
      setZoom(next);
    },
    [tool, setZoom],
  );

  const onScrollerPointerUp = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType !== "touch") return;
    const g = pinchRef.current;
    if (!g) return;
    g.pointers.delete(e.pointerId);
    if (g.pointers.size === 0) {
      pinchRef.current = null;
      clearTouches();
    }
  }, []);

  // Ctrl/⌘ + wheel is the trackpad pinch gesture on desktop.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      setZoom(useEditor.getState().zoom * (1 - e.deltaY / 500));
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [setZoom]);

  // A letter page is 816px wide, so on a phone it would open scrolled off the
  // right edge. Fit it to the viewport once on mount, then leave zoom alone —
  // this sets a sensible starting point rather than fighting the user.
  useEffect(() => {
    const available = window.innerWidth - 32;
    if (available < PAGE_WIDTH) setZoom(Math.max(0.25, available / PAGE_WIDTH));
  }, [setZoom]);

  // Keep the library's card art current. Regenerating on a slow interval
  // rather than per stroke keeps a rasterise off the drawing hot path.
  const revision = useEditor((s) => s.revision);
  useEffect(() => {
    if (!note || pages.length === 0) return;
    const timer = setTimeout(() => {
      try {
        const dataUrl = renderThumbnail(note, pages[0]);
        if (dataUrl) void notesRepo.saveThumbnail(note.id, dataUrl);
      } catch {
        /* canvas unavailable — the library falls back to a paper placeholder */
      }
    }, 2500);
    return () => clearTimeout(timer);
  }, [note, pages, revision]);

  // Flush pending writes if the tab goes away mid-stroke.
  useEffect(() => {
    const onHide = () => void flush();
    window.addEventListener("pagehide", onHide);
    document.addEventListener("visibilitychange", onHide);
    return () => {
      window.removeEventListener("pagehide", onHide);
      document.removeEventListener("visibilitychange", onHide);
    };
  }, [flush]);

  /* --- Keyboard ----------------------------------------------------------- */

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const typing =
        target?.tagName === "INPUT" ||
        target?.tagName === "TEXTAREA" ||
        target?.isContentEditable;

      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
        return;
      }
      if (typing) return;

      const toolKeys: Record<string, Parameters<typeof setTool>[0]> = {
        "1": "pen",
        "2": "highlighter",
        "3": "eraser",
        "4": "lasso",
        "5": "text",
        "6": "shape",
        "7": "sticky",
        "8": "image",
        "9": "hand",
      };
      if (toolKeys[e.key]) {
        e.preventDefault();
        setTool(toolKeys[e.key]);
        return;
      }
      if (e.key === "Backspace" || e.key === "Delete") {
        e.preventDefault();
        deleteSelection();
      }
      if ((e.metaKey || e.ctrlKey) && (e.key === "=" || e.key === "+")) {
        e.preventDefault();
        setZoom(zoom + 0.15);
      }
      if ((e.metaKey || e.ctrlKey) && e.key === "-") {
        e.preventDefault();
        setZoom(zoom - 0.15);
      }
      if ((e.metaKey || e.ctrlKey) && e.key === "0") {
        e.preventDefault();
        setZoom(1);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [undo, redo, setTool, deleteSelection, setZoom, zoom]);

  /* --- Insert actions ----------------------------------------------------- */

  const firstPageId = pages[0]?.id;

  const insertText = useCallback(() => {
    if (!firstPageId || !note) return;
    addObject(firstPageId, {
      kind: "text",
      id: newId("obj"),
      x: 80,
      y: 120,
      width: 420,
      html: "",
      fontSize: 18,
      color: defaultInkFor(note.paperColor),
    });
    toast.show("Text box added — click it to type");
  }, [firstPageId, note, addObject]);

  const insertShape = useCallback(() => {
    if (!firstPageId || !note) return;
    addObject(firstPageId, {
      kind: "shape",
      id: newId("obj"),
      shape: "rect",
      x: 100,
      y: 160,
      width: 200,
      height: 130,
      color: defaultInkFor(note.paperColor),
      strokeWidth: 2,
      fill: null,
    });
  }, [firstPageId, note, addObject]);

  const insertSticky = useCallback(() => {
    if (!firstPageId) return;
    addObject(firstPageId, {
      kind: "sticky",
      id: newId("obj"),
      x: 120,
      y: 180,
      width: 200,
      height: 200,
      text: "",
      // Cycle colours so consecutive notes are visually distinct.
      color: STICKY_COLORS[Math.floor(Math.random() * STICKY_COLORS.length)],
    });
    toast.show("Sticky note added");
  }, [firstPageId, addObject]);

  const onPickImage = useCallback(
    async (file: File) => {
      if (!firstPageId) return;
      const blobId = await blobs.put(file);
      const bitmap = await createImageBitmap(file).catch(() => null);
      const maxWidth = 380;
      const width = bitmap ? Math.min(maxWidth, bitmap.width) : maxWidth;
      const height = bitmap ? (bitmap.height / bitmap.width) * width : 260;
      bitmap?.close();

      addObject(firstPageId, {
        kind: "image",
        id: newId("obj"),
        x: 90,
        y: 150,
        width,
        height,
        rotation: 0,
        blobId,
      });
      toast.success("Image added");
    },
    [firstPageId, addObject],
  );

  // Selecting an insert tool performs the insert, then falls back to the pen —
  // these are actions, not modes, which is how Notability treats them too.
  useEffect(() => {
    if (tool === "text") {
      insertText();
      setTool("lasso");
    } else if (tool === "shape") {
      insertShape();
      setTool("lasso");
    } else if (tool === "sticky") {
      insertSticky();
      setTool("lasso");
    } else if (tool === "image") {
      fileRef.current?.click();
      setTool("pen");
    }
  }, [tool, insertText, insertShape, insertSticky, setTool]);

  if (loading) return <FullPageSpinner />;

  if (!note) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4">
        <p className="text-[var(--text-muted)]">That note could not be found.</p>
        <Button onClick={onBack}>Back to library</Button>
      </div>
    );
  }

  // Never wider than the viewport allows, so the page can always be reached.
  const pageWidth = Math.max(MIN_WIDTH, PAGE_WIDTH * zoom);

  return (
    <div className="flex min-h-screen flex-col bg-[var(--bg-subtle)]">
      <Toolbar onBack={onBack} />
      <RecordingBar noteId={noteId} autoStart={autoRecord} />
      <PageNavigator
        onJump={(pageId) =>
          document
            .getElementById(`page-${pageId}`)
            ?.scrollIntoView({ behavior: "smooth", block: "start" })
        }
      />

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void onPickImage(file);
          e.target.value = "";
        }}
      />

      <div
        ref={scrollRef}
        onPointerDown={onScrollerPointerDown}
        onPointerMove={onScrollerPointerMove}
        onPointerUp={onScrollerPointerUp}
        onPointerCancel={onScrollerPointerUp}
        className="flex-1 overflow-auto px-4 py-8"
      >
        <div className="mx-auto flex w-fit flex-col items-center gap-6">
          {pages.map((page, i) => (
            <div key={page.id} id={`page-${page.id}`} className="group/page relative">
              <PageSlot
                page={page}
                paper={note.paper}
                paperColor={note.paperColor}
                width={pageWidth}
                height={page.height * zoom}
                eager={i < 2}
              />

              <div className="mt-2 flex items-center justify-between px-1">
                <span className="text-[12px] font-semibold text-[var(--text-faint)]">
                  Page {i + 1} of {pages.length}
                </span>
                <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover/page:opacity-100 focus-within:opacity-100">
                  <Tooltip label="Insert page below">
                    <IconButton
                      label="Insert page below"
                      size="sm"
                      onClick={() => void addPage(i)}
                    >
                      <Plus />
                    </IconButton>
                  </Tooltip>
                  {pages.length > 1 && (
                    <Tooltip label="Delete page">
                      <IconButton
                        label="Delete page"
                        size="sm"
                        onClick={() => void removePage(page.id)}
                      >
                        <Trash2 />
                      </IconButton>
                    </Tooltip>
                  )}
                </div>
              </div>
            </div>
          ))}

          <Button variant="secondary" onClick={() => void addPage()} leading={<Plus className="h-4 w-4" />}>
            Add page
          </Button>
        </div>
      </div>

      {/* Floating zoom + paper controls */}
      <div className="pointer-events-none fixed bottom-5 right-5 z-30 flex flex-col items-end gap-2">
        <AnimatePresence>
          {paperOpen && (
            <motion.div
              initial={{ opacity: 0, y: 8, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 6, scale: 0.98 }}
              transition={spring.snap}
              className="pointer-events-auto w-[260px] rounded-[12px] border border-[var(--border-soft)] bg-[var(--surface)] p-3 shadow-[var(--shadow-lg)]"
            >
              <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-[var(--text-faint)]">
                Paper
              </p>
              <div className="grid grid-cols-2 gap-1">
                {PAPER_STYLES.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => void useEditor.getState().setPaper(s.id, note.paperColor)}
                    className={cn(
                      "rounded-[6px] px-2 py-1.5 text-left text-[13px] font-semibold transition-colors",
                      note.paper === s.id
                        ? "bg-[var(--brand-soft)] text-[var(--brand)]"
                        : "hover:bg-[var(--surface-2)]",
                    )}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
              <p className="mb-2 mt-3 text-[11px] font-bold uppercase tracking-wide text-[var(--text-faint)]">
                Colour
              </p>
              <div className="flex gap-2">
                {PAPER_COLORS.map((c) => (
                  <button
                    key={c.id}
                    aria-label={c.label}
                    onClick={() => void useEditor.getState().setPaper(note.paper, c.id)}
                    className={cn(
                      "h-7 w-7 rounded-full border transition-transform hover:scale-110",
                      note.paperColor === c.id
                        ? "border-[var(--brand)]"
                        : "border-[var(--border)]",
                    )}
                    style={{ background: c.swatch }}
                  />
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="pointer-events-auto flex items-center gap-1 rounded-full border border-[var(--border-soft)] bg-[var(--surface)] p-1 shadow-[var(--shadow-lg)]">
          <Tooltip label="Paper style">
            <IconButton
              label="Paper style"
              size="sm"
              active={paperOpen}
              onClick={() => setPaperOpen((v) => !v)}
            >
              <FileText />
            </IconButton>
          </Tooltip>
          <span className="mx-1 h-5 w-px bg-[var(--border-soft)]" />
          <Tooltip label="Zoom out  ·  ⌘−">
            <IconButton label="Zoom out" size="sm" onClick={() => setZoom(zoom - 0.15)}>
              <Minus />
            </IconButton>
          </Tooltip>
          <button
            onClick={() => setZoom(1)}
            className="min-w-[52px] rounded-full px-2 py-1 text-[12px] font-bold tabular-nums text-[var(--text-muted)] hover:bg-[var(--surface-2)]"
            aria-label="Reset zoom"
          >
            {Math.round(zoom * 100)}%
          </button>
          <Tooltip label="Zoom in  ·  ⌘+">
            <IconButton label="Zoom in" size="sm" onClick={() => setZoom(zoom + 0.15)}>
              <ZoomIn />
            </IconButton>
          </Tooltip>
        </div>
      </div>
    </div>
  );
}
