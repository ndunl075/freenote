type ClassValue = string | number | null | undefined | false | ClassValue[];

/** Tiny classnames joiner. No tailwind-merge: we keep conditional classes
 *  disjoint by construction rather than paying to reconcile them at runtime. */
export function cn(...values: ClassValue[]): string {
  const out: string[] = [];
  const walk = (v: ClassValue) => {
    if (!v && v !== 0) return;
    if (Array.isArray(v)) {
      v.forEach(walk);
      return;
    }
    out.push(String(v));
  };
  values.forEach(walk);
  return out.join(" ");
}
