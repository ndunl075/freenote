"use client";

import { Copy, FolderInput, MoreHorizontal, Pencil, Star, StarOff, Trash2 } from "lucide-react";
import { Menu, useMenu, type MenuEntry } from "@/components/menu/Menu";
import { IconButton } from "@/components/ui";
import { cn } from "@/lib/utils/cn";
import { duplicateItem, toggleStar } from "./actions";
import type { LibraryItem } from "./logic";
import { useLibrary } from "./store";

/** The ⋯ button and menu shared by note and set cards. */
export function ItemMenuButton({ item, className }: { item: LibraryItem; className?: string }) {
  const menu = useMenu();
  const setDialog = useLibrary((s) => s.setDialog);

  const items: MenuEntry[] = [
    { id: "rename", label: "Rename", icon: <Pencil />, onSelect: () => setDialog({ kind: "rename", item }) },
    { id: "duplicate", label: "Duplicate", icon: <Copy />, onSelect: () => void duplicateItem(item) },
    {
      id: "star",
      label: item.starred ? "Unstar" : "Star",
      icon: item.starred ? <StarOff /> : <Star />,
      onSelect: () => void toggleStar(item),
    },
    { id: "move", label: "Move to…", icon: <FolderInput />, onSelect: () => setDialog({ kind: "move", item }) },
    { id: "sep", separator: true },
    { id: "delete", label: "Delete", icon: <Trash2 />, danger: true, onSelect: () => setDialog({ kind: "delete", item }) },
  ];

  return (
    <>
      <IconButton
        size="sm"
        label={`More options for ${item.title}`}
        {...menu.triggerProps}
        className={cn(
          "bg-[var(--surface)] shadow-[var(--shadow-sm)] hover:bg-[var(--surface-2)]",
          className,
        )}
      >
        <MoreHorizontal />
      </IconButton>
      <Menu
        open={menu.open}
        onClose={menu.close}
        anchorRef={menu.anchorRef}
        items={items}
        label={`Options for ${item.title}`}
      />
    </>
  );
}
