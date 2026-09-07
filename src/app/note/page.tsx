"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { FullPageSpinner } from "@/components/ui";
import { NoteEditor } from "@/features/editor/NoteEditor";

function NoteRoute() {
  const params = useSearchParams();
  const router = useRouter();
  const id = params.get("id");

  if (!id) {
    router.replace("/");
    return <FullPageSpinner />;
  }
  return (
    <NoteEditor
      noteId={id}
      autoRecord={params.get("record") === "1"}
      onBack={() => router.push("/")}
    />
  );
}

// Static export prerenders this shell; the note id arrives from the query
// string on the client, so the whole route sits behind Suspense.
export default function Page() {
  return (
    <Suspense fallback={<FullPageSpinner />}>
      <NoteRoute />
    </Suspense>
  );
}
