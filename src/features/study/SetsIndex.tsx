"use client";

import { motion } from "framer-motion";
import { Layers, Plus } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { sets as setsRepo, type StudySet } from "@/lib/db";
import { Card, Spinner } from "@/components/ui";
import { riseIn, stagger } from "@/lib/motion/springs";
import { rowIn } from "./motion";
import { pluralize, relativeTime } from "@/lib/utils/format";
import { EmptyState } from "./EmptyState";
import { routes } from "./routes";
import { NavButton } from "./NavButton";

interface Row {
  set: StudySet;
  count: number;
}

/** `/set` with no id: every set on this device, newest first. */
export function SetsIndex() {
  const [rows, setRows] = useState<Row[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const all = await setsRepo.all();
      const counts = await Promise.all(all.map((s) => setsRepo.count(s.id)));
      if (!cancelled) setRows(all.map((set, i) => ({ set, count: counts[i] })));
    })().catch(() => {
      if (!cancelled) setRows([]);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!rows) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Spinner size={32} />
      </div>
    );
  }

  if (!rows.length) {
    return (
      <EmptyState
        Icon={Layers}
        title="No sets yet"
        description="Create your first set of terms and definitions to start studying."
        actions={
          <NavButton href={routes.create} leading={<Plus className="h-4 w-4" />}>
              Create a set
            </NavButton>
        }
      />
    );
  }

  return (
    <motion.main
      variants={stagger(0.04)}
      initial="hidden"
      animate="show"
      className="mx-auto w-full max-w-[1000px] px-4 pb-24 pt-8 md:px-8 md:pt-12"
    >
      <motion.header variants={riseIn} className="flex items-center justify-between gap-4">
        <h1 className="text-[30px] md:text-[36px]">Your sets</h1>
        <NavButton href={routes.create} leading={<Plus className="h-4 w-4" />}>
            Create
          </NavButton>
      </motion.header>

      <motion.ul variants={stagger(0.04)} className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {rows.map(({ set, count }) => (
          <motion.li key={set.id} variants={rowIn}>
            <Link href={routes.set(set.id)} className="block">
              <Card interactive className="flex h-full flex-col p-5">
                <span className="text-[17px] font-bold leading-tight">{set.title}</span>
                <span className="mt-1 text-[13px] font-semibold text-[var(--text-muted)]">
                  {pluralize(count, "term")}
                </span>
                <span className="mt-auto pt-4 text-[12px] text-[var(--text-faint)]">
                  Updated {relativeTime(set.updatedAt)}
                </span>
              </Card>
            </Link>
          </motion.li>
        ))}
      </motion.ul>
    </motion.main>
  );
}
