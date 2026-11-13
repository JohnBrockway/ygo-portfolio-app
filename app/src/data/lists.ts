import { useSyncExternalStore } from "react";
import {
  changeEntryQuantityInDatabase,
  clearListsInDatabase,
  createListInDatabase,
  deleteListInDatabase,
  loadListsFromDatabase,
  renameListInDatabase,
} from "./listsDb";
import type { EntryRecord, ListRecord, SaveResult } from "./listsDb";
import type { Edition } from "./types";

export interface ListsState {
  // "error": the last load or save failed. The lists and entries below are the last known ones and may be out of
  // date, so app is read-only until a later load succeeds.
  status: "loading" | "ready" | "error";
  error: string | null;
  // Only the lists the user has (not deleted). Deleted lists stay in the database until they have been synced, but
  // are left out here.
  activeLists: readonly ListRecord[];
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
  activeLists: readonly ListRecord[],
  activeEntries: readonly EntryRecord[],
): ListsState {
  return {
    status,
    error,
    activeLists,
    activeEntries,
    byPrinting: groupBy(activeEntries, (entry) => entry.printingId),
    byList: groupBy(activeEntries, (entry) => entry.listId),
  };
}

// The database is the source of truth; this is a copy of it in memory, so components can read synchronously.
// This memory copy only ever changes based on reading the database (never ahead of it).
// Components should only ever read through useLiveLists, change entries through changeEntryQuantity and change
// lists through createList, renameList, and deleteList.
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
  setState(makeState("error", message, state.activeLists, state.activeEntries));
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
// The queue's own value is never read, only whether the last operation has finished, hence unknown.
let queue: Promise<unknown> = Promise.resolve();

function enqueue<T>(operation: () => Promise<T>): Promise<T> {
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
    const activeLists = data.lists.filter((list) => !list.deleted);
    const activeEntries = data.entries.filter((entry) => entry.quantity > 0);
    setState(makeState("ready", null, activeLists, activeEntries));
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

export function getEntryQuantity(
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

// Puts a committed entry into memory, in place of memory's copy of the same entry if it has one. The committed entry
// is what the database holds now so it replaces memory's copy. Nothing is written to the database here.
function applyEntry(entry: EntryRecord): void {
  const otherEntries = state.activeEntries.filter((other) => !hasSameKey(entry, other));
  const activeEntries = entry.quantity > 0 ? [...otherEntries, entry] : otherEntries;
  setState(makeState(state.status, state.error, state.activeLists, activeEntries));
}

// Puts a committed list into memory, in place of memory's copy of the same list if it has one. The committed list is
// what the database holds now so it replaces memory's copy. A deleted list is ignored (like a removed entry in
// applyEntry), and its entries leave memory with it. Nothing is written to the database here.
function applyList(list: ListRecord): void {
  const otherLists = state.activeLists.filter((other) => other.id !== list.id);
  const activeLists = list.deleted ? otherLists : [...otherLists, list].sort((a, b) => a.order - b.order);
  const activeEntries = list.deleted
    ? state.activeEntries.filter((entry) => entry.listId !== list.id)
    : state.activeEntries;
  setState(makeState(state.status, state.error, activeLists, activeEntries));
}

const NOT_SAVED: SaveResult = { status: "failed", list: null, nameProblem: null };
const SAVED_WITHOUT_LIST: SaveResult = { status: "saved", list: null, nameProblem: null };

// Runs a change to the database through the queue. `change` makes the database call, applies what was saved to memory
// and tells the other tabs; this adds what every change needs around that:
// - Block saving while the lists are loading or in error (the UI is disabled then, so this is a stale click).
// - If the database call throws, nothing was saved and memory didn't change, so what is shown is still true. But a
//   database that can't be written to needs attention, so stop changes and show the banner until a reload works.
function enqueueChange(failureMessage: string, change: () => Promise<SaveResult>): Promise<SaveResult> {
  return enqueue(async () => {
    if (state.status !== "ready") {
      return NOT_SAVED;
    }
    try {
      return await change();
    } catch (error) {
      console.error(failureMessage, error);
      setErrorState(error);
      return NOT_SAVED;
    }
  });
}

// Changes how many of this printing's edition are on the list (0 removes it). `change` gets the quantity the
// database has right now and returns the new one: (current) => current + 1, or () => 1 to put it on a list.
// The database keeps the result between 0 and the list's maximum (1 on every list except Owned).
// The new quantity shows up once it has been saved. "saved" also covers the database already holding the quantity
// that was asked for, in which case nothing is written.
export function changeEntryQuantity(
  listId: string,
  printingId: string,
  edition: Edition,
  change: (current: number) => number,
): Promise<SaveResult> {
  return enqueueChange("Couldn't save list entry", async () => {
    const entry = await changeEntryQuantityInDatabase(listId, printingId, edition, change);
    if (entry !== null) {
      applyEntry(entry);
      notifyOtherTabs();
    }
    return SAVED_WITHOUT_LIST;
  });
}

// Adds a new list of the user's own after the existing ones. The new list shows up once it has been saved.
// "invalid-name" (empty, or already used by another list) is the caller's to show, and is not an error state: nothing
// went wrong with the database. "failed" on the other hand is an error, so should be caught by the banner.
export function createList(name: string): Promise<SaveResult> {
  return enqueueChange("Couldn't create list", async () => {
    const result = await createListInDatabase(name);
    if (result.status === "saved" && result.list !== null) {
      applyList(result.list);
      notifyOtherTabs();
    }
    return result;
  });
}

// Renames a list of the user's own (never a built-in one). The new name shows up once it has been saved. Results are
// the same as for createList: "invalid-name" is the caller's to show, "failed" is already in the banner.
export function renameList(listId: string, name: string): Promise<SaveResult> {
  return enqueueChange("Couldn't rename list", async () => {
    const result = await renameListInDatabase(listId, name);
    if (result.status === "saved" && result.list !== null) {
      applyList(result.list);
      notifyOtherTabs();
    }
    return result;
  });
}

// Deletes a list of the user's own (never a built-in one), along with its entries. They leave memory once the
// deletion has been saved.
export function deleteList(listId: string): Promise<SaveResult> {
  return enqueueChange("Couldn't delete list", async () => {
    const deletedList = await deleteListInDatabase(listId);
    applyList(deletedList);
    notifyOtherTabs();
    return SAVED_WITHOUT_LIST;
  });
}