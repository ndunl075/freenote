import { Suspense } from "react";
import { AppShell } from "@/components/shell/AppShell";
import { FullPageSpinner } from "@/components/ui";
import { SetEditor } from "@/features/study/editor/SetEditor";

export default function Page() {
  return (
    <AppShell>
      <Suspense fallback={<FullPageSpinner />}>
        <SetEditor />
      </Suspense>
    </AppShell>
  );
}
