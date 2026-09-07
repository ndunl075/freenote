import { Suspense } from "react";
import { FullPageSpinner } from "@/components/ui";
import { SetEditor } from "@/features/study/editor/SetEditor";

export default function Page() {
  return (
    <Suspense fallback={<FullPageSpinner />}>
      <SetEditor />
    </Suspense>
  );
}
