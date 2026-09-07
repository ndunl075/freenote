import { Suspense } from "react";
import { FullPageSpinner } from "@/components/ui";
import { StudyRouter } from "@/features/study/StudyRouter";

export default function Page() {
  return (
    <Suspense fallback={<FullPageSpinner />}>
      <StudyRouter />
    </Suspense>
  );
}
