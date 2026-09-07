/**
 * Subject colours.
 *
 * These are *data*, not theme tokens: `Subject.color` is persisted as a hex
 * string, travels in backups, and must render identically in light and dark
 * mode (a Biology tab is green on every device). That is why this is the one
 * place outside globals.css that spells out colour values. Each is a mid-tone
 * chosen to read on both the white and navy surfaces.
 */
export const SUBJECT_COLORS: { name: string; value: string }[] = [
  { name: "Indigo", value: "#4255ff" },
  { name: "Sky", value: "#2e9bff" },
  { name: "Teal", value: "#17b3a6" },
  { name: "Green", value: "#2fbf71" },
  { name: "Lime", value: "#8fc63e" },
  { name: "Yellow", value: "#f5b820" },
  { name: "Orange", value: "#ff8a3d" },
  { name: "Coral", value: "#ff725b" },
  { name: "Rose", value: "#f2547d" },
  { name: "Purple", value: "#9b5cf6" },
  { name: "Brown", value: "#a3765a" },
  { name: "Slate", value: "#7a8599" },
];

/** Picks the palette entry that is least used so new subjects stay distinct. */
export function nextSubjectColor(inUse: string[]): string {
  const counts = new Map(SUBJECT_COLORS.map((c) => [c.value.toLowerCase(), 0]));
  for (const c of inUse) {
    const key = c.toLowerCase();
    if (counts.has(key)) counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  let best = SUBJECT_COLORS[0].value;
  let min = Infinity;
  for (const { value } of SUBJECT_COLORS) {
    const n = counts.get(value.toLowerCase()) ?? 0;
    if (n < min) {
      min = n;
      best = value;
    }
  }
  return best;
}

export function colorName(value: string): string {
  return SUBJECT_COLORS.find((c) => c.value.toLowerCase() === value.toLowerCase())?.name ?? "Custom";
}
