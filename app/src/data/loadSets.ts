import { DATA_BASE_URL } from "../config";
import type { CardSet } from "./types";

export async function loadSets(): Promise<CardSet[]> {
  const response = await fetch(`${DATA_BASE_URL}/sets.json`);
  if (!response.ok) {
    throw new Error(`sets.json returned HTTP ${response.status}`);
  }
  const sets: CardSet[] = await response.json();
  return sets;
}