import { Suspense } from "react";
import { FullPageSpinner } from "@/components/ui";
import { SetPage } from "@/features/study/SetPage";

export default function Page() {
  return (
    <Suspense fallback={<FullPageSpinner />}>
      <SetPage />
    </Suspense>
  );
}
