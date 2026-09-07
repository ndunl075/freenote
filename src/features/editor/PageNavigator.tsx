"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Copy, PanelLeftClose, PanelLeftOpen, Plus, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { IconButton, Tooltip } from "@/components/ui";
import { PAGE_WIDTH, type Page, type PaperColor } from "@/lib/db";
import { paperPalette } from "@/lib/ink";
import { spring } from "@/lib/motion/springs";
import { cn } from "@/lib/utils/cn";
import { useEditor } from "./store";

const THUMB_WIDTH = 108;

/**
 * Notability's page navigator. Thumbnails are drawn as scaled SVG stroke
 * outlines rather than rasterised canvases — at this size the ink reads fine as
 * plain polylines, and it avoids keeping a second bitmap per page in memory
 * purely for navigation.
 */
export function PageNavigator({
  onJump,
}: {
  onJump: (pageId: string) => void;
}) {
  const pages = useEditor((s) => s.pages);
  const note = useEditor((s) => s.note);
  const addPage = useEditor((s) => s.addPage);
  const removePage = useEditor((s) => s.removePage);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "\\") {
        e.preventDefault();
        setOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  if (!note) return null;

  return (
    <>
      <div className="pointer-events-auto fixed left-5 top-1/2 z-20 -translate-y-1/2">
        {!open && (
          <Tooltip label="Pages  ·  ⌘\" side="right">
            <IconButton
              label="Show pages"
              onClick={() => setOpen(true)}
              className="bg-[var(--surface)] shadow-[var(--shadow-lg)]"
            >
              <PanelLeftOpen />
            </IconButton>
          </Tooltip>
        )}
      </div>

      <AnimatePresence>
        {open && (
          <motion.aside
            initial={{ x: -240, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: -240, opacity: 0 }}
            transition={spring.sheet}
            className="fixed bottom-0 left-0 top-14 z-20 flex w-[160px] flex-col border-r border-[var(--chrome-border)] bg-[var(--chrome)]/95 backdrop-blur-md"
            aria-label="Pages"
          >
            <div className="flex items-center justify-between px-3 py-2">
              <span className="text-[11px] font-bold uppercase tracking-wide text-[var(--text-faint)]">
                Pages
              </span>
              <IconButton label="Hide pages" size="sm" onClick={() => setOpen(false)}>
                <PanelLeftClose />
              </IconButton>
            </div>

            <div className="flex-1 space-y-3 overflow-y-auto px-3 pb-4">
              {pages.map((page, i) => (
                <div key={page.id} className="group/thumb relative">
                  <button
                    onClick={() => onJump(page.id)}
                    aria-label={`Go to page ${i + 1}`}
                    className={cn(
                      "block w-full overflow-hidden rounded-[4px] border-2 transition-all",
                      "border-[var(--border)] hover:border-[var(--brand)]",
                    )}
                  >
                    <PageThumb page={page} paperColor={note.paperColor} />
                  </button>
                  <span className="mt-1 block text-center text-[11px] font-semibold text-[var(--text-faint)]">
                    {i + 1}
                  </span>

                  <div className="absolute right-1 top-1 flex gap-1 opacity-0 transition-opacity group-hover/thumb:opacity-100">
                    <MiniButton label="Insert page after" onClick={() => void addPage(i)}>
                      <Plus className="h-3 w-3" />
                    </MiniButton>
                    {pages.length > 1 && (
                      <MiniButton
                        label="Delete page"
                        onClick={() => void removePage(page.id)}
                      >
                        <Trash2 className="h-3 w-3" />
                      </MiniButton>
                    )}
                  </div>
                </div>
              ))}

              <button
                onClick={() => void addPage()}
                className="flex h-16 w-full items-center justify-center gap-1 rounded-[4px] border-2 border-dashed border-[var(--border)] text-[12px] font-semibold text-[var(--text-muted)] transition-colors hover:border-[var(--brand)] hover:text-[var(--brand)]"
              >
                <Copy className="h-3.5 w-3.5" />
                Add page
              </button>
            </div>
          </motion.aside>
        )}
      </AnimatePresence>
    </>
  );
}

function MiniButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      aria-label={label}
      title={label}
      onClick={onClick}
      className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-[#0a092d]/80 text-white hover:bg-[#0a092d]"
    >
      {children}
    </button>
  );
}

function PageThumb({
  page,
  paperColor,
}: {
  page: Page;
  paperColor: PaperColor;
}) {
  const height = Math.round((page.height / PAGE_WIDTH) * THUMB_WIDTH);

  // Sample heavily: at thumbnail scale, every fourth point is indistinguishable
  // from every point, and a dense page can hold tens of thousands of them.
  const paths = useMemo(
    () =>
      page.strokes.slice(0, 400).map((stroke) => {
        const pts: string[] = [];
        for (let i = 0; i < stroke.points.length; i += 3 * 4) {
          pts.push(`${stroke.points[i].toFixed(1)},${stroke.points[i + 1].toFixed(1)}`);
        }
        return { id: stroke.id, points: pts.join(" "), color: stroke.color, width: stroke.size };
      }),
    [page.strokes],
  );

  return (
    <svg
      width={THUMB_WIDTH}
      height={height}
      viewBox={`0 0 ${PAGE_WIDTH} ${page.height}`}
      style={{ background: paperPalette(paperColor).bg, display: "block" }}
    >
      {paths.map((p) => (
        <polyline
          key={p.id}
          points={p.points}
          fill="none"
          stroke={p.color}
          strokeWidth={p.width * 2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ))}
    </svg>
  );
}
