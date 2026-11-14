import type { CardSet } from "./types";

// Every region that appears in the list, in a stable order.
export function getRegions(sets: CardSet[]): string[] {
  const regions = new Set<string>();
  for (const set of sets) {
    regions.add(set.region);
  }
  return Array.from(regions).sort();
}