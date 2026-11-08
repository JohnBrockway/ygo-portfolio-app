import { DATA_BASE_URL } from "../config";
import type { Card, CardSet, MasterData, SetCode } from "./types";

async function fetchJson<T>(fileName: string): Promise<T> {
  const response = await fetch(`${DATA_BASE_URL}/${fileName}`);
  if (!response.ok) {
    throw new Error(`${fileName} returned HTTP ${response.status}`);
  }
  const data: T = await response.json();
  return data;
}

export function loadSets(): Promise<CardSet[]> {
  return fetchJson<CardSet[]>("sets.json");
}

// Everything the app needs to show a set's printings.
export async function loadMasterData(): Promise<MasterData> {
  const [sets, setcodes, cards] = await Promise.all([
    loadSets(),
    fetchJson<SetCode[]>("printings.json"),
    fetchJson<Card[]>("cards.json"),
  ]);
  return { sets, setcodes, cards };
}