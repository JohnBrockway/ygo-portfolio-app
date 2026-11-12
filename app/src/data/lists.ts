import { useSyncExternalStore } from "react";
import { changeEntryQuantityInDatabase, clearListsInDatabase, loadListsFromDatabase } from "./listsDb";
import type { EntryRecord, ListRecord } from "./listsDb";
import type { Edition } from "./types";

export interface ListsState {
  // "error": the last load or save failed. The lists and entries below are the last known ones and may be out of
  // date, so app is read-only until a later load succeeds.
  status: "loading" | "ready" | "error";
  error: string | null;
  lists: readonly ListRecord[];
  // Only the entries that are on a list (quantity above 0). Removed entries stay in the database until they have
  // been synced, but are left out here.
  activeEntries: readonly EntryRecord[];
  // The active entries, grouped for lookups.
  byPrinting: ReadonlyMap<string, readonly EntryRecord[]>;
  byList: ReadonlyMap<string, readonly EntryRecord[]>;
}

function groupBy(
  entries: readonly EntryRecord[],
  getKey: (entry: EntryRecord) => string,
): Map<string, EntryRecord[]> {
  const groups = new Map<string, EntryRecord[]>();
  for (const entry of entries) {
    const key = getKey(entry);
    const group = groups.get(key);
    if (group === undefined) {
      groups.set(key, [entry]);
    } else {
      group.push(entry);
    }
  }
  return groups;
}

function makeState(
  status: ListsState["status"],
  error: string | null,
  lists: readonly ListRecord[],
  activeEntries: readonly EntryRecord[],
): ListsState {
  return {
    status,
    error,
    lists,
    activeEntries,
    byPrinting: groupBy(activeEntries, (entry) => entry.printingId),
    byList: groupBy(activeEntries, (entry) => entry.listId),
  };
}

// The database is the source of truth; this is a copy of it in memory, so components can read synchronously.
// This memory copy only ever changes based on reading the database (never ahead of it).
// Components should only ever read through useLiveLists and change entries through changeEntryQuantity.
// useSyncExternalStore needs getLists to return the same object until something changes, so the state is
// fully replaced (not edited) on every change.
let state: ListsState = makeState("loading", null, [], []);

const listeners = new Set<() => void>();

function setState(updatedState: ListsState): void {
  state = updatedState;
  listeners.forEach((listener) => listener());
}

// Keeps what is in memory, but marks it as no longer to be trusted.
function setErrorState(error: unknown): void {
  const message = error instanceof Error ? error.message : "Unknown error";
  setState(makeState("error", message, state.lists, state.activeEntries));
}

export function getLists(): ListsState {
  return state;
}

export function subscribeToLists(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

// The current lists, re-rendering the component whenever they change.
// How components stay up to date (useSyncExternalStore is React's way of reading data that lives outside React):
// 1. React calls subscribeToLists once for each component using useLiveLists, handing it a callback.
// 2. Whenever setState runs, every callback is called. That only tells React "something changed".
// 3. React then calls getLists and compares the result with last time. A different object re-renders that
//    component; the same object does nothing. That is why the state is replaced and never edited.
export function useLiveLists(): ListsState {
  return useSyncExternalStore(subscribeToLists, getLists);
}

// Everything that touches the database goes through this queue, one operation at a time, and each result is
// applied to memory before the next operation starts. So memory is always the result of the latest operation,
// never a slow read landing on top of a newer write.
let queue: Promise<void> = Promise.resolve();

function enqueue(operation: () => Promise<void>): Promise<void> {
  const result = queue.then(operation);
  // A failed operation must not stop the ones queued behind it.
  queue = result.catch(() => undefined);
  return result;
}

// --- Other tabs ---

// Tabs tell each other if they've changed data, because IndexedDB won't.
const channel = typeof BroadcastChannel === "undefined" ? null : new BroadcastChannel("ygo-lists");

function notifyOtherTabs(): void {
  if (channel !== null) {
    channel.postMessage("changed");
  }
}

if (channel !== null) {
  channel.onmessage = () => {
    void refreshLists();
  };
}

// Reload tabs that may be stale/sleeping and have missed notifications for ex. from other tabs.
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") {
    void refreshLists();
  }
});

// --- Loading and changing ---

// Reads every list and entry from the database into memory. Only call this from inside the queue.
async function loadIntoMemory(): Promise<void> {
  try {
    const data = await loadListsFromDatabase();
    const activeEntries = data.entries.filter((entry) => entry.quantity > 0);
    setState(makeState("ready", null, data.lists, activeEntries));
  } catch (error) {
    console.error("Couldn't load lists", error);
    setErrorState(error);
  }
}

export function refreshLists(): Promise<void> {
  return enqueue(loadIntoMemory);
}

// Dev tool: wipes the lists in the database, then reloads memory from it.
export function clearLists(): Promise<void> {
  return enqueue(async () => {
    await clearListsInDatabase();
    await loadIntoMemory();
    notifyOtherTabs();
  });
}

export function getEntryQuantityInList(
  listsState: ListsState,
  listId: string,
  printingId: string,
  edition: Edition,
): number {
  const entries = listsState.byPrinting.get(printingId);
  if (entries === undefined) {
    return 0;
  }
  const entry = entries.find((entry) => entry.listId === listId && entry.edition === edition);
  return entry === undefined ? 0 : entry.quantity;
}

function hasSameKey(entry: EntryRecord, other: EntryRecord): boolean {
  return entry.listId === other.listId && entry.printingId === other.printingId && entry.edition === other.edition;
}

// Puts a committed entry into memory.
function applyEntry(entry: EntryRecord): void {
  const otherEntries = state.activeEntries.filter((other) => !hasSameKey(entry, other));
  const activeEntries = entry.quantity > 0 ? [...otherEntries, entry] : otherEntries;
  setState(makeState(state.status, state.error, state.lists, activeEntries));
}

// Changes how many of this printing's edition are on the list (0 removes it). `change` gets the quantity the
// database has right now and returns the new one: (current) => current + 1, or () => 1 to put it on a list.
// The database keeps the result between 0 and the list's maximum (1 on every list except Owned).
// The new quantity shows up once it has been saved.
export function changeEntryQuantity(
  listId: string,
  printingId: string,
  edition: Edition,
  change: (current: number) => number,
): Promise<void> {
  return enqueue(async () => {
    if (state.status !== "ready") {
      return;
    }
    try {
      const entry = await changeEntryQuantityInDatabase(listId, printingId, edition, change);
      if (entry !== null) {
        applyEntry(entry);
        notifyOtherTabs();
      }
    } catch (error) {
      // Nothing was saved and memory didn't change, so what is shown is still true. But a database that can't be
      // written to needs attention, so stop changes and show the banner until a reload works.
      console.error("Couldn't save list entry", error);
      setErrorState(error);
    }
  });
}