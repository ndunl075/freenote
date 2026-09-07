import { Suspense } from "react";
import { AppShell } from "@/components/shell/AppShell";
import { FullPageSpinner } from "@/components/ui";
import { SetPage } from "@/features/study/SetPage";

// The set page sits inside the app frame rather than going full-bleed:
// Notability keeps its chrome on content screens and drops it only for
// focused, full-screen activities.
export default function Page() {
  return (
    <AppShell>
      <Suspense fallback={<FullPageSpinner />}>
        <SetPage />
      </Suspense>
    </AppShell>
  );
}
