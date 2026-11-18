import { getGroup, groupBy } from "./recordGroupingHelpers";
import {
  changeEntryQuantityInDatabase,
  clearListsInDatabase,
  createListInDatabase,
  deleteListInDatabase,
  loadListsFromDatabase,
  OWNED_LIST_ID,
  renameListInDatabase,
} from "./listsDb";
import type { ListEntryRecord, ListRecord, SaveResult } from "./listsDb";
import { canChangeState, createMemoryStore, replaceActiveRecords } from "./memoryStore";
import type { MemoryStoreState } from "./memoryStore";
import { compareByOrder, SAVED_WITHOUT_RECORD } from "./recordConventions";
import type { Edition } from "./types";

// The memory layer for lists. binders.ts is the same layer for binders and is laid out the same way; what both do alike
// lives in memoryStore.ts.

export interface ListsState extends MemoryStoreState {
  // Only the lists the user has (not deleted). Deleted lists stay in the database until they have been synced, but
  // are left out here.
  activeLists: readonly ListRecord[];
  // Only the entries that are on a list (quantity above 0). Removed entries stay in the database until they have
  // been synced, but are left out here.
  activeEntries: readonly ListEntryRecord[];
  // The active entries, grouped for lookups.
  byPrinting: ReadonlyMap<string, readonly ListEntryRecord[]>;
  byList: ReadonlyMap<string, readonly ListEntryRecord[]>;
}

// One edition of one printing, as held by the Owned list and by every other list. 
export interface EntryOwnership {
  // The quantity on the Owned list.
  ownedQuantity: number;
  // How many lists other than Owned hold the edition. Each of them holds at most 1 of it, so this is also how many
  // copies those lists hold between them.
  nonOwnedListCount: number;
}

function makeState(
  status: ListsState["status"],
  error: string | null,
  activeLists: readonly ListRecord[],
  activeEntries: readonly ListEntryRecord[],
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

// Reads every list and entry from the database, for memory.
async function loadListsState(): Promise<ListsState> {
  const data = await loadListsFromDatabase();
  const activeLists = data.lists.filter((list) => !list.deleted);
  const activeEntries = data.entries.filter((entry) => entry.quantity > 0);
  return makeState("ready", null, activeLists, activeEntries);
}

// Components should only ever read through useLiveLists, change entries through changeEntryQuantity and change
// lists through createList, renameList, and deleteList.
const listsStore = createMemoryStore<ListsState>({
  name: "lists",
  initialState: makeState("loading", null, [], []),
  loadState: loadListsState,
  clearDatabase: clearListsInDatabase,
});

export const getLists = listsStore.getState;

// Whether lists can be changed (see canChangeState).
export const canChangeLists = canChangeState;

export const subscribeToLists = listsStore.subscribe;

// The current lists, re-rendering the component whenever they change.
export const useLiveLists = listsStore.useLiveState;

// Reads every list and entry from the database into memory.
export const refreshLists = listsStore.refresh;

// Dev tool: wipes the lists in the database, then reloads memory from it.
export const clearLists = listsStore.clear;

export function getEntryQuantity(
  listsState: ListsState,
  listId: string,
  printingId: string,
  edition: Edition,
): number {
  const entries = getGroup(listsState.byPrinting, printingId);
  const entry = entries.find((candidate) => candidate.listId === listId && candidate.edition === edition);
  return entry === undefined ? 0 : entry.quantity;
}

// How many lists other than Owned hold this edition of this printing. There is at most one entry per list, printing and
// edition, so counting the entries counts the lists.
export function getNonOwnedListCount(listsState: ListsState, printingId: string, edition: Edition): number {
  const entries = getGroup(listsState.byPrinting, printingId);
  return entries.filter((entry) => entry.edition === edition && entry.listId !== OWNED_LIST_ID).length;
}

// What the Owned list and the other lists each hold of this edition of this printing, side by side.
export function getEntryOwnership(listsState: ListsState, printingId: string, edition: Edition): EntryOwnership {
  return {
    ownedQuantity: getEntryQuantity(listsState, OWNED_LIST_ID, printingId, edition),
    nonOwnedListCount: getNonOwnedListCount(listsState, printingId, edition),
  };
}

// Every entry on the list (none removed), in no particular order.
export function getListEntries(listsState: ListsState, listId: string): readonly ListEntryRecord[] {
  return getGroup(listsState.byList, listId);
}

function getEntryKey(entry: ListEntryRecord): string {
  return JSON.stringify([entry.listId, entry.printingId, entry.edition]);
}

// Puts a committed entry into memory, in place of memory's copy of the same entry if it has one. Nothing is written to
// the database here.
function applyEntry(entry: ListEntryRecord): void {
  const state = listsStore.getState();
  const activeEntries = replaceActiveRecords(
    state.activeEntries,
    [entry],
    getEntryKey,
    (committed) => committed.quantity > 0,
  );
  listsStore.setState(makeState(state.status, state.error, state.activeLists, activeEntries));
}

// Puts a committed list into memory, in place of memory's copy of the same list if it has one. A deleted list is
// ignored (like a removed entry in applyEntry), and its entries leave memory with it. Nothing is written to the
// database here.
function applyList(list: ListRecord): void {
  const state = listsStore.getState();
  const activeLists = replaceActiveRecords(
    state.activeLists,
    [list],
    (other) => other.id,
    (committed) => !committed.deleted,
  ).sort(compareByOrder);
  const activeEntries = list.deleted
    ? state.activeEntries.filter((entry) => entry.listId !== list.id)
    : state.activeEntries;
  listsStore.setState(makeState(state.status, state.error, activeLists, activeEntries));
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
  return listsStore.enqueueChange("Couldn't save list entry", async () => {
    const entry = await changeEntryQuantityInDatabase(listId, printingId, edition, change);
    if (entry !== null) {
      applyEntry(entry);
      listsStore.notifyOtherTabs();
    }
    return SAVED_WITHOUT_RECORD;
  });
}

// Adds a new list of the user's own after the existing ones. The new list shows up once it has been saved.
// "invalid-name" (empty, or already used by another list) is the caller's to show, and is not an error state: nothing
// went wrong with the database. "failed" on the other hand is an error, so should be caught by the banner.
export function createList(name: string): Promise<SaveResult> {
  return listsStore.enqueueChange("Couldn't create list", async () => {
    const result = await createListInDatabase(name);
    if (result.status === "saved" && result.record !== null) {
      applyList(result.record);
      listsStore.notifyOtherTabs();
    }
    return result;
  });
}

// Renames a list of the user's own (never a built-in one). The new name shows up once it has been saved. Results are
// the same as for createList: "invalid-name" is the caller's to show, "failed" is already in the banner.
export function renameList(listId: string, name: string): Promise<SaveResult> {
  return listsStore.enqueueChange("Couldn't rename list", async () => {
    const result = await renameListInDatabase(listId, name);
    if (result.status === "saved" && result.record !== null) {
      applyList(result.record);
      listsStore.notifyOtherTabs();
    }
    return result;
  });
}

// Deletes a list of the user's own (never a built-in one), along with its entries. They leave memory once the
// deletion has been saved.
export function deleteList(listId: string): Promise<SaveResult> {
  return listsStore.enqueueChange("Couldn't delete list", async () => {
    const deletedList = await deleteListInDatabase(listId);
    applyList(deletedList);
    listsStore.notifyOtherTabs();
    return SAVED_WITHOUT_RECORD;
  });
}