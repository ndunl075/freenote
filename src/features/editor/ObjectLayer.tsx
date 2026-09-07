"use client";

import { useEffect, useRef, useState } from "react";
import { Trash2 } from "lucide-react";
import type { NoteObject, Page } from "@/lib/db";
import { PAGE_WIDTH, blobs } from "@/lib/db";
import { cn } from "@/lib/utils/cn";
import { useEditor } from "./store";

/**
 * Text, images, shapes and sticky notes live in the DOM above the ink canvas
 * rather than being rasterised into it. Text has to stay selectable and
 * editable, and images have to stay resamplable — burning either into a bitmap
 * would make them permanent the moment they were placed.
 */
export function ObjectLayer({ page, width }: { page: Page; width: number }) {
  const scale = width / PAGE_WIDTH;
  const tool = useEditor((s) => s.tool);
  const selection = useEditor((s) => s.selection);
  const selectionPageId = useEditor((s) => s.selectionPageId);

  return (
    <div
      className="pointer-events-none absolute inset-0"
      style={{ transform: `scale(${scale})`, transformOrigin: "top left", width: PAGE_WIDTH }}
    >
      {page.objects.map((obj) => (
        <ObjectView
          key={obj.id}
          page={page}
          object={obj}
          interactive={tool === "lasso" || tool === "text" || tool === "hand"}
          selected={selectionPageId === page.id && selection.objectIds.has(obj.id)}
        />
      ))}
    </div>
  );
}

function ObjectView({
  page,
  object,
  interactive,
  selected,
}: {
  page: Page;
  object: NoteObject;
  interactive: boolean;
  selected: boolean;
}) {
  const updateObject = useEditor((s) => s.updateObject);
  const removeObject = useEditor((s) => s.removeObject);

  const common = {
    position: "absolute" as const,
    left: object.x,
    top: object.y,
  };

  const wrapper = cn(
    "group",
    interactive ? "pointer-events-auto" : "pointer-events-none",
    selected && "outline outline-2 outline-[var(--brand)] outline-offset-2",
  );

  if (object.kind === "text") {
    return (
      <div style={{ ...common, width: object.width }} className={wrapper}>
        <TextObject
          object={object}
          onCommit={(html) => {
            if (html !== object.html) updateObject(page.id, object, { ...object, html });
          }}
          onDelete={() => removeObject(page.id, object)}
        />
      </div>
    );
  }

  if (object.kind === "image") {
    return (
      <div
        style={{ ...common, width: object.width, height: object.height, transform: `rotate(${object.rotation}deg)` }}
        className={wrapper}
      >
        <ImageObject object={object} />
        {interactive && <DeleteChip onClick={() => removeObject(page.id, object)} />}
      </div>
    );
  }

  if (object.kind === "sticky") {
    return (
      <div
        style={{ ...common, width: object.width, height: object.height, background: object.color }}
        className={cn(wrapper, "rounded-[4px] p-3 shadow-[var(--shadow-md)]")}
      >
        <textarea
          value={object.text}
          readOnly={!interactive}
          onChange={(e) => updateObject(page.id, object, { ...object, text: e.target.value })}
          className="h-full w-full resize-none bg-transparent text-[14px] text-[#2b2200] outline-none"
          aria-label="Sticky note"
        />
        {interactive && <DeleteChip onClick={() => removeObject(page.id, object)} />}
      </div>
    );
  }

  return (
    <div
      style={{ ...common, width: object.width, height: object.height }}
      className={wrapper}
    >
      <ShapeObject object={object} />
      {interactive && <DeleteChip onClick={() => removeObject(page.id, object)} />}
    </div>
  );
}

function DeleteChip({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      aria-label="Delete"
      className={cn(
        "absolute -right-3 -top-3 hidden h-6 w-6 items-center justify-center rounded-full",
        "bg-[var(--incorrect)] text-white shadow-[var(--shadow-md)] group-hover:flex",
      )}
    >
      <Trash2 className="h-3 w-3" />
    </button>
  );
}

function TextObject({
  object,
  onCommit,
  onDelete,
}: {
  object: Extract<NoteObject, { kind: "text" }>;
  onCommit: (html: string) => void;
  onDelete: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  // Only seed the DOM from state — React must not own this subtree's children,
  // or every keystroke would reset the caret to the start.
  useEffect(() => {
    if (ref.current && ref.current.innerHTML !== object.html) {
      ref.current.innerHTML = object.html;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [object.id]);

  return (
    <div className="group relative">
      <div
        ref={ref}
        contentEditable
        suppressContentEditableWarning
        role="textbox"
        aria-multiline="true"
        aria-label="Text box"
        onBlur={(e) => onCommit(e.currentTarget.innerHTML)}
        className="min-h-[1.4em] w-full outline-none focus:ring-2 focus:ring-[var(--brand)] focus:ring-offset-2"
        style={{ fontSize: object.fontSize, color: object.color, lineHeight: 1.4 }}
      />
      <DeleteChip onClick={onDelete} />
    </div>
  );
}

function ImageObject({ object }: { object: Extract<NoteObject, { kind: "image" }> }) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    let revoked: string | null = null;
    let cancelled = false;

    void blobs.url(object.blobId).then((next) => {
      if (cancelled) {
        if (next) URL.revokeObjectURL(next);
        return;
      }
      revoked = next;
      setUrl(next);
    });

    return () => {
      cancelled = true;
      if (revoked) URL.revokeObjectURL(revoked);
    };
  }, [object.blobId]);

  if (!url) return <div className="h-full w-full rounded-[4px] bg-[var(--surface-2)]" />;
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={url} alt="" className="h-full w-full rounded-[4px] object-contain" draggable={false} />;
}

function ShapeObject({ object }: { object: Extract<NoteObject, { kind: "shape" }> }) {
  const { shape, width, height, color, strokeWidth, fill } = object;
  const half = strokeWidth / 2;

  return (
    <svg width={width} height={height} className="overflow-visible">
      {shape === "rect" && (
        <rect
          x={half}
          y={half}
          width={Math.max(0, width - strokeWidth)}
          height={Math.max(0, height - strokeWidth)}
          rx={4}
          stroke={color}
          strokeWidth={strokeWidth}
          fill={fill ?? "none"}
        />
      )}
      {shape === "ellipse" && (
        <ellipse
          cx={width / 2}
          cy={height / 2}
          rx={Math.max(0, width / 2 - half)}
          ry={Math.max(0, height / 2 - half)}
          stroke={color}
          strokeWidth={strokeWidth}
          fill={fill ?? "none"}
        />
      )}
      {(shape === "line" || shape === "arrow") && (
        <>
          <line
            x1={0}
            y1={height}
            x2={width}
            y2={0}
            stroke={color}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
          />
          {shape === "arrow" && (
            <polygon
              points={`${width},0 ${width - 12},2 ${width - 3},12`}
              fill={color}
            />
          )}
        </>
      )}
    </svg>
  );
}
