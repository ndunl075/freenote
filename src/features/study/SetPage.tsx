"use client";

import { useSearchParams } from "next/navigation";
import { SetDetail } from "./SetDetail";
import { SetsIndex } from "./SetsIndex";

/** `/set?id=…` → set detail; bare `/set` → the list of sets. */
export function SetPage() {
  const params = useSearchParams();
  const id = params.get("id");
  return id ? <SetDetail id={id} /> : <SetsIndex />;
}
