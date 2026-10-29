import type { CardSet } from "./types";

// Every region that appears in the list, in a stable order.
export function getRegions(sets: CardSet[]): string[] {
  const regions = new Set<string>();
  for (const set of sets) {
    regions.add(set.region);
  }
  return Array.from(regions).sort();
}

// Returns a new set (React state must not be mutated in place).
export function toggleRegion(disabledRegions: Set<string>, region: string): Set<string> {
  const next = new Set(disabledRegions);
  if (next.has(region)) {
    next.delete(region);
  } else {
    next.add(region);
  }
  return next;
}