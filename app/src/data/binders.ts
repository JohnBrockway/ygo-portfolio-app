import {
  addCardToBinderInDatabase,
  addListCardsToBinderInDatabase,
  addPageToBinderInDatabase,
  clearBindersInDatabase,
  clearCardPlacementInDatabase,
  countDirtyBindersDataFromDatabase,
  createBinderInDatabase,
  deleteBinderInDatabase,
  detachCardFromListInDatabase,
  loadBindersFromDatabase,
  placeCardInSlotInDatabase,
  removeCardFromBinderInDatabase,
  removeLastPageFromBinderInDatabase,
  renameBinderInDatabase,
} from "./bindersDb";
import type { BinderCardRecord, BinderRecord, BinderSaveResult, SlotPlacement } from "./bindersDb";
import { getGroup, groupBy } from "./recordGroupingHelpers";
import { canChangeLists, getListEntries, getLists } from "./lists";
import { canChangeState, createMemoryStore, replaceActiveRecords } from "./memoryStore";
import type { MemoryStoreState } from "./memoryStore";
import { compareByOrder, NOT_SAVED, SAVED_WITHOUT_RECORD } from "./recordConventions";
import type { Edition } from "./types";

// The memory layer for binders. lists.ts is the same layer for lists and is laid out the same way; what both do alike
// lives in memoryStore.ts.

export interface BindersState extends MemoryStoreState {
  // Only the binders the user has (not deleted). Deleted binders stay in the database until they have been synced, but
  // are left out here.
  activeBinders: readonly BinderRecord[];
  // Only the cards that are in a binder (not removed). Removed cards stay in the database until they have been synced,
  // but are left out here.
  activeCards: readonly BinderCardRecord[];
  // The active cards, grouped for lookups.
  byBinder: ReadonlyMap<string, readonly BinderCardRecord[]>;
}

function makeState(
  status: BindersState["status"],
  error: string | null,
  activeBinders: readonly BinderRecord[],
  activeCards: readonly BinderCardRecord[],
): BindersState {
  return {
    status,
    error,
    activeBinders,
    activeCards,
    byBinder: groupBy(activeCards, (card) => card.binderId),
  };
}

// Reads every binder and card from the database, for memory.
async function loadBindersState(): Promise<BindersState> {
  const data = await loadBindersFromDatabase();
  const activeBinders = data.binders.filter((binder) => !binder.deleted);
  const activeCards = data.cards.filter((card) => !card.deleted);
  return makeState("ready", null, activeBinders, activeCards);
}

// Components should only ever read through useLiveBinders (and useLiveBindersDirtyCount for sync state), and
// change binders and their cards through the functions below (createBinder, renameBinder, deleteBinder,
// addPageToBinder, removeLastPageFromBinder, addCardToBinder, addListToBinder, removeCardFromBinder,
// placeCardInSlot, clearCardPlacement, detachCardFromList).
const bindersStore = createMemoryStore<BindersState>({
  name: "binders",
  initialState: makeState("loading", null, [], []),
  loadState: loadBindersState,
  clearDatabase: clearBindersInDatabase,
  countDirtyRecords: countDirtyBindersDataFromDatabase,
});

export const getBinders = bindersStore.getState;

// Whether binders can be changed (see canChangeState).
export const canChangeBinders = canChangeState;

export const subscribeToBinders = bindersStore.subscribe;

// The current binders, re-rendering the component whenever they change.
export const useLiveBinders = bindersStore.useLiveState;

// How many binders and cards have changed here and not yet been synced, deleted ones included (see
// MemoryStore.getDirtyCount).
export const getBindersDirtyCount = bindersStore.getDirtyCount;

// The number of unsynced binders and cards, re-rendering the component whenever it changes.
export const useLiveBindersDirtyCount = bindersStore.useLiveDirtyCount;

// Reads every binder and card from the database into memory.
export const refreshBinders = bindersStore.refresh;

// Dev tool: wipes the binders in the database, then reloads memory from it.
export const clearBinders = bindersStore.clear;

// Tells the other tabs to reload the binders from the database. For the sync layer, which changes the database without
// going through the functions below (see MemoryStore.notifyOtherTabs).
export const notifyOtherTabsOfBinders = bindersStore.notifyOtherTabs;

// Every card in the binder (none removed), placed or not, in no particular order.
export function getBinderCards(bindersState: BindersState, binderId: string): readonly BinderCardRecord[] {
  return getGroup(bindersState.byBinder, binderId);
}

// Puts committed cards into memory, in place of memory's copy of the same cards if it has them. A removed card is
// ignored. Nothing is written to the database here.
function applyCards(cards: readonly BinderCardRecord[]): void {
  const state = bindersStore.getState();
  const activeCards = replaceActiveRecords(
    state.activeCards,
    cards,
    (other) => other.id,
    (committed) => !committed.deleted,
  );
  bindersStore.setState(makeState(state.status, state.error, state.activeBinders, activeCards));
}

// Puts a committed binder into memory, in place of memory's copy of the same binder if it has one. A deleted binder is
// ignored (like a removed card in applyCards), and its cards leave memory with it. Nothing is written to the database
// here.
function applyBinder(binder: BinderRecord): void {
  const state = bindersStore.getState();
  const activeBinders = replaceActiveRecords(
    state.activeBinders,
    [binder],
    (other) => other.id,
    (committed) => !committed.deleted,
  ).sort(compareByOrder);
  const activeCards = binder.deleted
    ? state.activeCards.filter((card) => card.binderId !== binder.id)
    : state.activeCards;
  bindersStore.setState(makeState(state.status, state.error, activeBinders, activeCards));
}

// Adds a new binder after the existing ones, with the given grid for every page (fixed from then on). The new binder
// shows up once it has been saved. "invalid-name" (empty, or already used by another binder) is the caller's to show,
// and is not an error state: nothing went wrong with the database. "failed" on the other hand is an error, so should be
// caught by the banner.
export function createBinder(name: string, columns: number, rows: number): Promise<BinderSaveResult> {
  return bindersStore.enqueueChange("Couldn't create binder", async () => {
    const result = await createBinderInDatabase(name, columns, rows);
    if (result.status === "saved" && result.record !== null) {
      applyBinder(result.record);
      bindersStore.notifyOtherTabs();
    }
    return result;
  });
}

// Renames a binder. The new name shows up once it has been saved. Results are the same as for createBinder:
// "invalid-name" is the caller's to show, "failed" is already in the banner.
export function renameBinder(binderId: string, name: string): Promise<BinderSaveResult> {
  return bindersStore.enqueueChange("Couldn't rename binder", async () => {
    const result = await renameBinderInDatabase(binderId, name);
    if (result.status === "saved" && result.record !== null) {
      applyBinder(result.record);
      bindersStore.notifyOtherTabs();
    }
    return result;
  });
}

// Deletes a binder along with its cards. They leave memory once the deletion has been saved.
export function deleteBinder(binderId: string): Promise<BinderSaveResult> {
  return bindersStore.enqueueChange("Couldn't delete binder", async () => {
    const deletedBinder = await deleteBinderInDatabase(binderId);
    applyBinder(deletedBinder);
    bindersStore.notifyOtherTabs();
    return SAVED_WITHOUT_RECORD;
  });
}

// Adds one empty page at the end of the binder. The page shows up once it has been saved.
export function addPageToBinder(binderId: string): Promise<BinderSaveResult> {
  return bindersStore.enqueueChange("Couldn't add page to binder", async () => {
    const binder = await addPageToBinderInDatabase(binderId);
    applyBinder(binder);
    bindersStore.notifyOtherTabs();
    return SAVED_WITHOUT_RECORD;
  });
}

// Removes the last page of the binder (never going below the minimum number of pages, see MIN_PAGE_COUNT). The cards
// that were in its slots stay in the binder, unplaced. The change shows up once it has been saved.
export function removeLastPageFromBinder(binderId: string): Promise<BinderSaveResult> {
  return bindersStore.enqueueChange("Couldn't remove page from binder", async () => {
    const removal = await removeLastPageFromBinderInDatabase(binderId);
    // The cards go first, so memory never has a card placed on a page that is gone.
    if (removal.unplacedCards.length > 0) {
      applyCards(removal.unplacedCards);
    }
    applyBinder(removal.binder);
    bindersStore.notifyOtherTabs();
    return SAVED_WITHOUT_RECORD;
  });
}

// Adds one card to the binder directly (not from a list), not placed in any slot. Adding the same printing + edition
// again adds another card. The card shows up once it has been saved.
export function addCardToBinder(
  binderId: string,
  cardId: string,
  printingId: string,
  edition: Edition,
): Promise<BinderSaveResult> {
  return bindersStore.enqueueChange("Couldn't add card to binder", async () => {
    const card = await addCardToBinderInDatabase(binderId, cardId, printingId, edition);
    applyCards([card]);
    bindersStore.notifyOtherTabs();
    return SAVED_WITHOUT_RECORD;
  });
}

// Adds the cards the list holds that the binder doesn't have yet (see addListCardsToBinderInDatabase), taking the list's
// entries as they are in memory when this runs. The cards show up once they have been saved. "saved" also covers the
// binder already having everything on the list, in which case nothing is written.
export function addListToBinder(binderId: string, listId: string): Promise<BinderSaveResult> {
  return bindersStore.enqueueChange("Couldn't add list to binder", async () => {
    // The entries are only to be trusted while the lists are ready, and only exist for a list that still exists. The UI
    // only offers such lists while they are ready, so otherwise this is a stale click: refused, like a change made while
    // not ready.
    const listsState = getLists();
    if (!canChangeLists(listsState) || !listsState.activeLists.some((list) => list.id === listId)) {
      return NOT_SAVED;
    }

    const cards = await addListCardsToBinderInDatabase(binderId, listId, getListEntries(listsState, listId));
    if (cards.length > 0) {
      applyCards(cards);
      bindersStore.notifyOtherTabs();
    }
    return SAVED_WITHOUT_RECORD;
  });
}

// Removes a card from its binder, which also empties its slot. The card leaves memory once the removal has been saved.
// "saved" also covers the card already being removed, in which case nothing is written.
export function removeCardFromBinder(cardId: string): Promise<BinderSaveResult> {
  return bindersStore.enqueueChange("Couldn't remove card from binder", async () => {
    const card = await removeCardFromBinderInDatabase(cardId);
    if (card !== null) {
      applyCards([card]);
      bindersStore.notifyOtherTabs();
    }
    return SAVED_WITHOUT_RECORD;
  });
}

// Puts a card in a slot. A card already in that slot changes places with it (see placeCardInSlotInDatabase). The new
// placements show up once they have been saved. "saved" also covers the card already being in that slot, in which case
// nothing is written.
export function placeCardInSlot(cardId: string, placement: SlotPlacement): Promise<BinderSaveResult> {
  return bindersStore.enqueueChange("Couldn't place card in slot", async () => {
    const cards = await placeCardInSlotInDatabase(cardId, placement);
    if (cards.length > 0) {
      applyCards(cards);
      bindersStore.notifyOtherTabs();
    }
    return SAVED_WITHOUT_RECORD;
  });
}

// Takes a card out of its slot, back to unplaced. "saved" also covers the card already being unplaced, in which case
// nothing is written.
export function clearCardPlacement(cardId: string): Promise<BinderSaveResult> {
  return bindersStore.enqueueChange("Couldn't take card out of slot", async () => {
    const card = await clearCardPlacementInDatabase(cardId);
    if (card !== null) {
      applyCards([card]);
      bindersStore.notifyOtherTabs();
    }
    return SAVED_WITHOUT_RECORD;
  });
}

// Makes a card that came from a list a card that was added directly, so it no longer counts as belonging to that list.
// "saved" also covers the card already having been added directly, in which case nothing is written.
export function detachCardFromList(cardId: string): Promise<BinderSaveResult> {
  return bindersStore.enqueueChange("Couldn't detach card from list", async () => {
    const card = await detachCardFromListInDatabase(cardId);
    if (card !== null) {
      applyCards([card]);
      bindersStore.notifyOtherTabs();
    }
    return SAVED_WITHOUT_RECORD;
  });
}