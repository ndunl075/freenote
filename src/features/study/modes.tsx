import { BookOpen, ClipboardCheck, Layers, LayoutGrid, Rocket } from "lucide-react";
import type { ComponentType, SVGProps } from "react";
import type { StudyMode } from "@/lib/db";

export interface ModeMeta {
  id: StudyMode;
  label: string;
  /** One-liner used on tiles' tooltips and the empty state. */
  blurb: string;
  Icon: ComponentType<SVGProps<SVGSVGElement>>;
}

/** Same order Quizlet lists them in on the set page. */
export const MODES: ModeMeta[] = [
  { id: "flashcards", label: "Flashcards", blurb: "Flip through your terms.", Icon: Layers },
  { id: "learn", label: "Learn", blurb: "Adaptive questions until you master every term.", Icon: BookOpen },
  { id: "test", label: "Test", blurb: "A practice exam graded at the end.", Icon: ClipboardCheck },
  { id: "match", label: "Match", blurb: "Pair terms and definitions against the clock.", Icon: LayoutGrid },
  { id: "blast", label: "Blast", blurb: "Type the term before it hits the ground.", Icon: Rocket },
];

export const modeMeta = (id: StudyMode): ModeMeta => MODES.find((m) => m.id === id) ?? MODES[0];
