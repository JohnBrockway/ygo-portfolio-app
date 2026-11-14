import { createConnectionGetter, putAll, requestToPromise } from "./indexedDb";
import type { ListEntryRecord } from "./listsDb";
import {
  changedRecord,
  compareByOrder,
  createTrackedStore,
  findNameProblem,
  getLiveRecordOrThrow,
  getNextOrder,
  makeRecordId,
} from "./recordConventions";
import type { RecordSaveResult } from "./recordConventions";
import type { Edition } from "./types";

// The database layer for binders. Only binders.ts may call the functions that change data (.*InDatabase): it's what keeps
// memory and the other tabs in step with the database, and a direct call would skip that. Reading with loadBindersFromDatabase is fine
// anywhere (e.g. the dev panel). listsDb.ts is the same layer for lists and is laid out the same way; what both do alike
// lives in indexedDb.ts and recordConventions.ts.
//
// A binder holds cards. Each card is one physical copy of a specific printing + edition, so two copies of the same
// printing are two cards. A card is either unplaced or sits in one slot (a position on one of the binder's pages).
// Every slot holds at most one card.

const DB_NAME = "ygo-binders";
const DB_VERSION = 1;

const BINDERS_STORE = "binders";
const CARDS_STORE = "cards";
const BY_BINDER_INDEX = "byBinder";

// The grid of every page of a binder, fixed when the binder is created.
export const MIN_GRID_SIZE = 1;
export const MAX_GRID_SIZE = 6;

// How many pages a new binder starts with: a single first page, one spread, and a single last page.
const INITIAL_PAGE_COUNT = 4;

export interface BinderRecord {
  id: string;
  name: string;
  order: number;
  columns: number;
  rows: number;
  // The pages in binder order. Pages are identified by id (not position), so adding a page at the start doesn't change
  // where any card is placed.
  pageIds: string[];
  deleted: boolean;
  createdAt: number;
  updatedAt: number;
  // Not a boolean because IndexedDB can't index booleans
  dirty: number;
}

// Where a card was added from, if it came from a list. `copyIndex` tells apart the copies of one printing + edition
// that a list holds (as the Owned list can hold several), counting from 0.
export interface ListOrigin {
  listId: string;
  copyIndex: number;
}

// A position in a binder: slotIndex counts from 0, row by row, so it is below columns * rows.
export interface SlotPlacement {
  pageId: string;
  slotIndex: number;
}

export interface BinderCardRecord {
  id: string;
  binderId: string;
  printingId: string;
  edition: Edition;
  // null for a card that was added to the binder directly, not from a list.
  listOrigin: ListOrigin | null;
  // null while the card is not in any slot.
  placement: SlotPlacement | null;
  // A removed card is kept until the removal has been synced to permanent storage. It has no placement.
  deleted: boolean;
  createdAt: number;
  updatedAt: number;
  dirty: number;
}

// Which end of the binder a page is added to.
export type BinderEnd = "start" | "end";

// Everything on disk, for loading into memory. Includes deleted binders and cards, kept
// until deletion has been synced to permanent storage.
export interface BindersData {
  binders: BinderRecord[];
  cards: BinderCardRecord[];
}

// What every change to the binders reports, in both layers (see RecordSaveResult). `record` is the binder as saved
// when one was created or renamed.
export type BinderSaveResult = RecordSaveResult<BinderRecord>;

// --- Opening the database ---

function upgradeSchema(db: IDBDatabase, oldVersion: number): void {
  // Each future schema change adds another "if (oldVersion < N)" block here.
  if (oldVersion < 1) {
    createTrackedStore(db, BINDERS_STORE, "id");

    const cards = createTrackedStore(db, CARDS_STORE, "id");
    cards.createIndex(BY_BINDER_INDEX, "binderId");
  }
}

// One shared connection for the whole app.
const getBindersConnection = createConnectionGetter(DB_NAME, DB_VERSION, upgradeSchema);

// --- Reading ---

export async function loadBindersFromDatabase(): Promise<BindersData> {
  const connection = await getBindersConnection();
  return connection.runTransaction([BINDERS_STORE, CARDS_STORE], "readonly", async (tx) => {
    const binders: BinderRecord[] = await requestToPromise(tx.objectStore(BINDERS_STORE).getAll());
    binders.sort(compareByOrder);

    const cards: BinderCardRecord[] = await requestToPromise(tx.objectStore(CARDS_STORE).getAll());

    return { binders, cards };
  });
}

// Reads a binder that has not been deleted. Anything else is a mistake in the caller or a stale screen, so it throws.
function getLiveBinderOrThrow(binderStore: IDBObjectStore, binderId: string): Promise<BinderRecord> {
  return getLiveRecordOrThrow<BinderRecord>(binderStore, binderId, `Binder "${binderId}"`);
}

// Reads a card that has not been removed. Anything else is a mistake in the caller or a stale screen, so it throws.
function getLiveCardOrThrow(cardStore: IDBObjectStore, cardId: string): Promise<BinderCardRecord> {
  return getLiveRecordOrThrow<BinderCardRecord>(cardStore, cardId, `Binder card "${cardId}"`);
}

// Every card of the binder, removed ones included.
function getCardsOfBinder(cardStore: IDBObjectStore, binderId: string): Promise<BinderCardRecord[]> {
  return requestToPromise(cardStore.index(BY_BINDER_INDEX).getAll(binderId));
}

// --- Operations ---

function throwIfGridSizeInvalid(columns: number, rows: number): void {
  for (const [label, size] of [
    ["columns", columns],
    ["rows", rows],
  ] as const) {
    if (!Number.isInteger(size) || size < MIN_GRID_SIZE || size > MAX_GRID_SIZE) {
      throw new Error(`A binder needs ${MIN_GRID_SIZE} to ${MAX_GRID_SIZE} ${label}, not ${size}`);
    }
  }
}

// Adds a binder after the existing ones, with INITIAL_PAGE_COUNT empty pages. The name is checked against the binders
// that are in the database right now, inside the same transaction, so two tabs can't both create the same name. A
// refused name is not a failure of the database: it resolves with "invalid-name" and the reason, and nothing is saved.
// A grid size outside MIN_GRID_SIZE..MAX_GRID_SIZE throws.
export async function createBinderInDatabase(name: string, columns: number, rows: number): Promise<BinderSaveResult> {
  throwIfGridSizeInvalid(columns, rows);
  const connection = await getBindersConnection();
  return connection.runTransaction([BINDERS_STORE], "readwrite", async (tx): Promise<BinderSaveResult> => {
    const store = tx.objectStore(BINDERS_STORE);
    const existingBinders: BinderRecord[] = await requestToPromise(store.getAll());

    const trimmedName = name.trim();
    const nameProblem = findNameProblem(
      trimmedName,
      existingBinders.filter((existing) => !existing.deleted),
    );
    if (nameProblem !== null) {
      return { status: "invalid-name", record: null, nameProblem };
    }

    const now = Date.now();
    const binder: BinderRecord = {
      id: makeRecordId(),
      name: trimmedName,
      order: getNextOrder(existingBinders),
      columns,
      rows,
      pageIds: Array.from({ length: INITIAL_PAGE_COUNT }, () => makeRecordId()),
      deleted: false,
      createdAt: now,
      updatedAt: now,
      dirty: 1,
    };
    await requestToPromise(store.add(binder));
    return { status: "saved", record: binder, nameProblem: null };
  });
}

// Renames a binder. Checked like createBinderInDatabase, against the other binders that are in the database right now.
// A binder that doesn't exist or is deleted throws (see getLiveBinderOrThrow). Giving the binder the name it already has
// resolves as saved without writing.
export async function renameBinderInDatabase(binderId: string, name: string): Promise<BinderSaveResult> {
  const connection = await getBindersConnection();
  return connection.runTransaction([BINDERS_STORE], "readwrite", async (tx): Promise<BinderSaveResult> => {
    const store = tx.objectStore(BINDERS_STORE);
    const binder = await getLiveBinderOrThrow(store, binderId);
    const existingBinders: BinderRecord[] = await requestToPromise(store.getAll());

    const trimmedName = name.trim();
    const nameProblem = findNameProblem(
      trimmedName,
      existingBinders.filter((existing) => existing.id !== binderId && !existing.deleted),
    );
    if (nameProblem !== null) {
      return { status: "invalid-name", record: null, nameProblem };
    }
    if (trimmedName === binder.name) {
      return { status: "saved", record: binder, nameProblem: null };
    }

    const renamedBinder = changedRecord(binder, { name: trimmedName }, Date.now());
    await requestToPromise(store.put(renamedBinder));
    return { status: "saved", record: renamedBinder, nameProblem: null };
  });
}

// Deletes a binder: marks it deleted and removes every card in it (which also empties their slots), all in one
// transaction so a binder is never deleted with live cards left behind. Both are kept in the database until synced
// (soft delete). A binder that doesn't exist or is already deleted throws (see getLiveBinderOrThrow). Resolves with
// the binder as saved.
export async function deleteBinderInDatabase(binderId: string): Promise<BinderRecord> {
  const connection = await getBindersConnection();
  return connection.runTransaction([BINDERS_STORE, CARDS_STORE], "readwrite", async (tx): Promise<BinderRecord> => {
    const binderStore = tx.objectStore(BINDERS_STORE);
    const cardStore = tx.objectStore(CARDS_STORE);
    const binder = await getLiveBinderOrThrow(binderStore, binderId);
    const binderCards = await getCardsOfBinder(cardStore, binderId);

    const now = Date.now();
    const deletedBinder = changedRecord(binder, { deleted: true }, now);
    const removedCards = binderCards
      .filter((card) => !card.deleted)
      .map((card) => changedRecord(card, { placement: null, deleted: true }, now));

    await Promise.all([requestToPromise(binderStore.put(deletedBinder)), putAll(cardStore, removedCards)]);
    return deletedBinder;
  });
}

// Adds one empty page at the start or the end of the binder. Resolves with the binder as saved. A binder that doesn't
// exist or is deleted throws.
export async function addPageToBinderInDatabase(binderId: string, end: BinderEnd): Promise<BinderRecord> {
  const connection = await getBindersConnection();
  return connection.runTransaction([BINDERS_STORE], "readwrite", async (tx): Promise<BinderRecord> => {
    const store = tx.objectStore(BINDERS_STORE);
    const binder = await getLiveBinderOrThrow(store, binderId);

    const newPageId = makeRecordId();
    const pageIds = end === "start" ? [newPageId, ...binder.pageIds] : [...binder.pageIds, newPageId];
    const updatedBinder = changedRecord(binder, { pageIds }, Date.now());
    await requestToPromise(store.put(updatedBinder));
    return updatedBinder;
  });
}

function makeBinderCard(
  binderId: string,
  printingId: string,
  edition: Edition,
  listOrigin: ListOrigin | null,
  now: number,
): BinderCardRecord {
  return {
    id: makeRecordId(),
    binderId,
    printingId,
    edition,
    listOrigin,
    placement: null,
    deleted: false,
    createdAt: now,
    updatedAt: now,
    dirty: 1,
  };
}

// Adds one card to a binder directly (not from a list), not placed in any slot. Adding the same printing + edition
// again adds another card. Resolves with the card as saved. A binder that doesn't exist or is deleted throws.
export async function addCardToBinderInDatabase(
  binderId: string,
  printingId: string,
  edition: Edition,
): Promise<BinderCardRecord> {
  const connection = await getBindersConnection();
  return connection.runTransaction([BINDERS_STORE, CARDS_STORE], "readwrite", async (tx): Promise<BinderCardRecord> => {
    await getLiveBinderOrThrow(tx.objectStore(BINDERS_STORE), binderId);

    const card = makeBinderCard(binderId, printingId, edition, null, Date.now());
    await requestToPromise(tx.objectStore(CARDS_STORE).add(card));
    return card;
  });
}

function makeCopyKey(printingId: string, edition: Edition, copyIndex: number): string {
  return JSON.stringify([printingId, edition, copyIndex]);
}

// Adds the cards a list holds that the binder doesn't have yet. Each copy on the list (an Owned entry with quantity 2
// is two copies) becomes one card that remembers its list and its copy number, and a copy that already has a live card
// in this binder from the same list is skipped, so adding a list again only adds what is new. Cards that came from
// other lists, or were added directly, are never matched. A removed card no longer counts as in the binder, so its
// copy is added again. Not placed in any slot. `entries` must be the entries of the list `listId` (as read from
// memory by binders.ts), all with a quantity above 0; anything else throws. Resolves with the cards added (none if
// the binder already had everything).
export async function addListCardsToBinderInDatabase(
  binderId: string,
  listId: string,
  entries: readonly ListEntryRecord[],
): Promise<BinderCardRecord[]> {
  for (const entry of entries) {
    if (entry.listId !== listId || entry.quantity <= 0) {
      throw new Error(`Can't add a copy to the binder from list "${listId}": it was given an entry that isn't on it`);
    }
  }

  const connection = await getBindersConnection();
  return connection.runTransaction([BINDERS_STORE, CARDS_STORE], "readwrite", async (tx): Promise<BinderCardRecord[]> => {
    await getLiveBinderOrThrow(tx.objectStore(BINDERS_STORE), binderId);
    const cardStore = tx.objectStore(CARDS_STORE);
    const binderCards = await getCardsOfBinder(cardStore, binderId);

    const copiesAlreadyAdded = new Set<string>();
    for (const card of binderCards) {
      if (!card.deleted && card.listOrigin !== null && card.listOrigin.listId === listId) {
        copiesAlreadyAdded.add(makeCopyKey(card.printingId, card.edition, card.listOrigin.copyIndex));
      }
    }

    const now = Date.now();
    const addedCards: BinderCardRecord[] = [];
    for (const entry of entries) {
      for (let copyIndex = 0; copyIndex < entry.quantity; copyIndex++) {
        if (!copiesAlreadyAdded.has(makeCopyKey(entry.printingId, entry.edition, copyIndex))) {
          addedCards.push(makeBinderCard(binderId, entry.printingId, entry.edition, { listId, copyIndex }, now));
        }
      }
    }

    await putAll(cardStore, addedCards);
    return addedCards;
  });
}

// Removes a card from its binder: marks it removed and empties its slot, in one write. Kept in the database until
// synced (soft delete). A card that is already removed, or no longer in the database, is already what was asked for,
// so (like lowering a quantity below 0 for lists) that resolves with null without writing, since a stale screen can
// ask for it. Otherwise resolves with the card as saved.
export async function removeCardFromBinderInDatabase(cardId: string): Promise<BinderCardRecord | null> {
  const connection = await getBindersConnection();
  return connection.runTransaction([CARDS_STORE], "readwrite", async (tx): Promise<BinderCardRecord | null> => {
    const store = tx.objectStore(CARDS_STORE);
    const card: BinderCardRecord | undefined = await requestToPromise(store.get(cardId));
    if (card === undefined || card.deleted) {
      return null;
    }

    const removedCard = changedRecord(card, { placement: null, deleted: true }, Date.now());
    await requestToPromise(store.put(removedCard));
    return removedCard;
  });
}

function isSamePlacement(a: SlotPlacement | null, b: SlotPlacement | null): boolean {
  if (a === null || b === null) {
    return a === b;
  }
  return a.pageId === b.pageId && a.slotIndex === b.slotIndex;
}

// Puts a card in a slot. If another card is already in that slot it changes places: it takes the slot the placed card
// came from, or becomes unplaced if the placed card wasn't in a slot. The slot must exist on this binder (a page of the
// binder, and a slot index below columns * rows). A card that is missing or removed, a binder that is missing or
// deleted, or a slot that doesn't exist throws. Resolves with every card that changed, as saved: the placed card first,
// then the card it replaced if there was one. Empty if the card is already in that slot.
export async function placeCardInSlotInDatabase(cardId: string, placement: SlotPlacement): Promise<BinderCardRecord[]> {
  const connection = await getBindersConnection();
  return connection.runTransaction([BINDERS_STORE, CARDS_STORE], "readwrite", async (tx): Promise<BinderCardRecord[]> => {
    const cardStore = tx.objectStore(CARDS_STORE);
    const card = await getLiveCardOrThrow(cardStore, cardId);
    const binder = await getLiveBinderOrThrow(tx.objectStore(BINDERS_STORE), card.binderId);

    const slotCount = binder.columns * binder.rows;
    if (
      !binder.pageIds.includes(placement.pageId) ||
      !Number.isInteger(placement.slotIndex) ||
      placement.slotIndex < 0 ||
      placement.slotIndex >= slotCount
    ) {
      throw new Error(`Binder "${binder.id}" has no slot ${placement.slotIndex} on page "${placement.pageId}"`);
    }
    if (isSamePlacement(card.placement, placement)) {
      return [];
    }

    const binderCards = await getCardsOfBinder(cardStore, binder.id);
    const occupant = binderCards.find(
      (other) => !other.deleted && other.id !== card.id && isSamePlacement(other.placement, placement),
    );

    const now = Date.now();
    const changedCards = [changedRecord(card, { placement }, now)];
    if (occupant !== undefined) {
      changedCards.push(changedRecord(occupant, { placement: card.placement }, now));
    }

    await putAll(cardStore, changedCards);
    return changedCards;
  });
}

// Takes a card out of its slot, back to unplaced. A card that is already unplaced, removed, or no longer in the
// database is already what was asked for, so that resolves with null without writing (a stale screen can ask for it).
// Otherwise resolves with the card as saved.
export async function clearCardPlacementInDatabase(cardId: string): Promise<BinderCardRecord | null> {
  const connection = await getBindersConnection();
  return connection.runTransaction([CARDS_STORE], "readwrite", async (tx): Promise<BinderCardRecord | null> => {
    const store = tx.objectStore(CARDS_STORE);
    const card: BinderCardRecord | undefined = await requestToPromise(store.get(cardId));
    if (card === undefined || card.deleted || card.placement === null) {
      return null;
    }

    const unplacedCard = changedRecord(card, { placement: null }, Date.now());
    await requestToPromise(store.put(unplacedCard));
    return unplacedCard;
  });
}

// Makes a card that came from a list a card that was added directly, so it no longer counts as belonging to that list.
// A card that is missing or removed throws. A card that was already added directly resolves with null without writing.
// Otherwise resolves with the card as saved.
export async function detachCardFromListInDatabase(cardId: string): Promise<BinderCardRecord | null> {
  const connection = await getBindersConnection();
  return connection.runTransaction([CARDS_STORE], "readwrite", async (tx): Promise<BinderCardRecord | null> => {
    const store = tx.objectStore(CARDS_STORE);
    const card = await getLiveCardOrThrow(store, cardId);
    if (card.listOrigin === null) {
      return null;
    }

    const detachedCard = changedRecord(card, { listOrigin: null }, Date.now());
    await requestToPromise(store.put(detachedCard));
    return detachedCard;
  });
}

// Dev tool: wipes every binder and card.
export async function clearBindersInDatabase(): Promise<void> {
  const connection = await getBindersConnection();
  await connection.clearStores([BINDERS_STORE, CARDS_STORE]);
}