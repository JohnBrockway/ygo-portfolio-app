import { createConnectionGetter, putAll, requestToPromise } from "./indexedDb";
import type { IndexedDbConnection } from "./indexedDb";
import {
  applyRemoteRecords,
  changedRecord,
  compareByOrder,
  countDirtyRecords,
  createTrackedStore,
  findNameProblem,
  getDirtyRecords,
  getLiveRecordOrThrow,
  getNextOrder,
  makeRecordId,
  markRecordsSynced,
} from "./recordConventions";
import type { RecordSaveResult, RemoteRecord } from "./recordConventions";
import type { Edition } from "./types";

// The database layer for lists. Only lists.ts may call the functions that change data (changeEntryQuantityInDatabase,
// createListInDatabase, renameListInDatabase, deleteListInDatabase, clearListsInDatabase): it keeps memory and the
// other tabs in step with the database, and a direct call would skip that. Reading with loadListsFromDatabase is
// fine anywhere (e.g. the dev panel). bindersDb.ts is the same layer for binders and is laid out the same way; what
// both do alike lives in indexedDb.ts and recordConventions.ts.
//
// The sync-only functions (markListsDataSyncedInDatabase, applyRemoteListsDataToDatabase) are the exception to the
// above: only the sync layer calls them, and it brings memory and the other tabs up to date itself afterwards.
// loadDirtyListsDataFromDatabase and countDirtyListsDataFromDatabase only read, so like loadListsFromDatabase they are
// fine anywhere.

const DB_NAME = "ygo-lists";
const DB_VERSION = 1;

const LISTS_STORE = "lists";
const ENTRIES_STORE = "entries";

export const OWNED_LIST_ID = "owned";
export const WISHLIST_LIST_ID = "wishlist";

const BUILT_IN_LISTS = [
  { id: OWNED_LIST_ID, name: "Owned", order: 0 },
  { id: WISHLIST_LIST_ID, name: "Wishlist", order: 1 },
];

export interface ListRecord {
  id: string;
  name: string;
  order: number;
  builtIn: boolean;
  deleted: boolean;
  createdAt: number;
  updatedAt: number;
  // Not a boolean because IndexedDB can't index booleans
  dirty: number;
}

// cardId is currently passed for future proofing; when we want to support marking generic cards instead of specific
// printings (ex. I want *any* copy of Dark Magician, as opposed to I want LOB-005 1st Ed.), we can key the IDB entry
// with printingId & edition being "" (IDB doesn't allow null keys, but will allow the empty string)
export interface ListEntryRecord {
  listId: string;
  // Always the card of printingId: the database can't check that, so callers have to pass the right one.
  cardId: string;
  printingId: string;
  edition: Edition;
  // Owned list: number of copies. Every other list: always 1.
  // 0 means removed; the record is kept until the removal has been synced.
  quantity: number;
  updatedAt: number;
  dirty: number;
}

// Everything on disk, for loading into memory. Includes deleted lists, kept
// until deletion has been synced to permanent storage.
export interface ListsData {
  lists: ListRecord[];
  entries: ListEntryRecord[];
}

// The cloud's copy of what a ListsData holds, as downloaded: records without `dirty` (see RemoteRecord).
export interface RemoteListsData {
  lists: RemoteRecord<ListRecord>[];
  entries: RemoteRecord<ListEntryRecord>[];
}

// What every change to the lists reports, in both layers (see RecordSaveResult). `record` is the list as saved when
// one was created or renamed.
export type SaveResult = RecordSaveResult<ListRecord>;

// --- Opening the database ---

function upgradeSchema(db: IDBDatabase, oldVersion: number): void {
  // Each future schema change adds another "if (oldVersion < N)" block here.
  if (oldVersion < 1) {
    createTrackedStore(db, LISTS_STORE, "id");
    createTrackedStore(db, ENTRIES_STORE, ["listId", "cardId", "printingId", "edition"]);
  }
}

// Runs on every open and only adds what is missing, so new built-in lists never need a migration.
// Seeded lists are not dirty: every device creates them locally, so there is nothing to sync.
async function ensureBuiltInLists(connection: IndexedDbConnection): Promise<void> {
  await connection.runTransaction([LISTS_STORE], "readwrite", async (tx) => {
    const store = tx.objectStore(LISTS_STORE);
    for (const list of BUILT_IN_LISTS) {
      const existing = await requestToPromise(store.get(list.id));
      if (existing === undefined) {
        const now = Date.now();
        const record: ListRecord = {
          ...list,
          builtIn: true,
          deleted: false,
          createdAt: now,
          updatedAt: now,
          dirty: 0,
        };
        await requestToPromise(store.add(record));
      }
    }
  });
}

// One shared connection for the whole app. Opening it also makes sure the built-in lists exist.
const getListsConnection = createConnectionGetter(DB_NAME, DB_VERSION, upgradeSchema, ensureBuiltInLists);

// --- Reading ---

export async function loadListsFromDatabase(): Promise<ListsData> {
  const connection = await getListsConnection();
  return connection.runTransaction([LISTS_STORE, ENTRIES_STORE], "readonly", async (tx) => {
    const lists: ListRecord[] = await requestToPromise(tx.objectStore(LISTS_STORE).getAll());
    lists.sort(compareByOrder);

    const entries: ListEntryRecord[] = await requestToPromise(tx.objectStore(ENTRIES_STORE).getAll());

    return { lists, entries };
  });
}

// Reads a list that has not been deleted. Anything else is a mistake in the caller or a stale screen, so it throws.
function getLiveListOrThrow(listStore: IDBObjectStore, listId: string): Promise<ListRecord> {
  return getLiveRecordOrThrow<ListRecord>(listStore, listId, `List "${listId}"`);
}

// Reads a list the user may rename or delete: it must exist, not be deleted, and not be built in. Anything else is a
// mistake in the caller (the UI doesn't offer these actions) or a stale screen, so it throws.
async function getMutableListOrThrow(listStore: IDBObjectStore, listId: string): Promise<ListRecord> {
  const list = await getLiveListOrThrow(listStore, listId);
  if (list.builtIn) {
    throw new Error(`The built-in list "${list.name}" can't be renamed or deleted`);
  }
  return list;
}

// Every entry of the list, removed ones included.
function getEntriesOfList(entryStore: IDBObjectStore, listId: string): Promise<ListEntryRecord[]> {
  // Entry keys are arrays: [listId, cardId, printingId, edition]. IndexedDB sorts keys by comparing them element by
  // element (an array that is a prefix of another sorts first), and any array sorts after any string. So:
  // - [listId] is below every key of this list (same first element, but shorter), and
  // - [listId, []] is above every key of this list (same first element, then an array in the place where real keys
  //   have a string, arrays being sorted above strings as a rule).
  // A key of another list is decided by its first element alone, which differs from listId, so it falls outside.
  return requestToPromise(entryStore.getAll(IDBKeyRange.bound([listId], [listId, []])));
}

// --- Operations ---

function getMaxQuantity(listId: string): number {
  return listId === OWNED_LIST_ID ? Infinity : 1;
}

// Changes one entry's quantity inside a single transaction, so the current quantity is read and the new one written
// with nothing able to write in between, even from another tab (IndexedDB runs transactions that write to the same
// store one at a time, across every tab). `cardId` must be the card that `printingId` belongs to (see ListEntryRecord).
// `change` gets the current quantity (0 if the entry isn't on the list) and
// returns the new one, which is kept between 0 and the list's maximum. Below 0 is clamped quietly, because a stale
// screen can ask for it (another tab already removed the entry). Above the maximum is a mistake in the caller, so it
// is clamped too but logged, should be impossible. Resolves with the entry as saved, or null if nothing needed saving.
export async function changeEntryQuantityInDatabase(
  listId: string,
  cardId: string,
  printingId: string,
  edition: Edition,
  change: (current: number) => number,
): Promise<ListEntryRecord | null> {
  const connection = await getListsConnection();
  return connection.runTransaction([LISTS_STORE, ENTRIES_STORE], "readwrite", async (tx) => {
    await getLiveListOrThrow(tx.objectStore(LISTS_STORE), listId);

    const store = tx.objectStore(ENTRIES_STORE);
    const existing: ListEntryRecord | undefined = await requestToPromise(
      store.get([listId, cardId, printingId, edition]),
    );
    const current = existing === undefined ? 0 : existing.quantity;

    const wanted = change(current);
    const maxQuantity = getMaxQuantity(listId);
    if (wanted > maxQuantity) {
      console.warn(`Asked for ${wanted} of one edition on list "${listId}", which holds at most ${maxQuantity}`);
    }
    const quantity = Math.min(Math.max(wanted, 0), maxQuantity);
    if (quantity === current) {
      return null;
    }

    // An entry that isn't in the database yet starts out as a removed one that was never synced, so that every entry
    // gets its updatedAt and dirty from changedRecord.
    const baseEntry: ListEntryRecord = existing ?? {
      listId,
      cardId,
      printingId,
      edition,
      quantity: 0,
      updatedAt: 0,
      dirty: 0,
    };
    const entry = changedRecord(baseEntry, { quantity }, Date.now());
    await requestToPromise(store.put(entry));
    return entry;
  });
}

// Adds a user-made list after the existing ones. The name is checked against the lists that are in the database right
// now, inside the same transaction, so two tabs can't both create the same name. A refused name is not a failure of the
// database: it resolves with "invalid-name" and the reason, and nothing is saved.
export async function createListInDatabase(name: string): Promise<SaveResult> {
  const connection = await getListsConnection();
  return connection.runTransaction([LISTS_STORE], "readwrite", async (tx): Promise<SaveResult> => {
    const store = tx.objectStore(LISTS_STORE);
    const existingLists: ListRecord[] = await requestToPromise(store.getAll());

    const trimmedName = name.trim();
    // A deleted list no longer holds its name.
    const nameProblem = findNameProblem(
      trimmedName,
      existingLists.filter((existing) => !existing.deleted),
    );
    if (nameProblem !== null) {
      return { status: "invalid-name", record: null, nameProblem };
    }

    const now = Date.now();
    const list: ListRecord = {
      id: makeRecordId(),
      name: trimmedName,
      order: getNextOrder(existingLists),
      builtIn: false,
      deleted: false,
      createdAt: now,
      updatedAt: now,
      // Unlike the seeded built-in lists, this exists on this device only, so it still has to be synced.
      dirty: 1,
    };
    await requestToPromise(store.add(list));
    return { status: "saved", record: list, nameProblem: null };
  });
}

// Renames a user-made list. Checked like createListInDatabase, against the other lists that are in the database right
// now. Built-in lists, and lists that don't exist or are deleted, throw (see getMutableListOrThrow). Giving the list the
// name it already has resolves as saved without writing.
export async function renameListInDatabase(listId: string, name: string): Promise<SaveResult> {
  const connection = await getListsConnection();
  return connection.runTransaction([LISTS_STORE], "readwrite", async (tx): Promise<SaveResult> => {
    const store = tx.objectStore(LISTS_STORE);
    const list = await getMutableListOrThrow(store, listId);
    const existingLists: ListRecord[] = await requestToPromise(store.getAll());

    const trimmedName = name.trim();
    const nameProblem = findNameProblem(
      trimmedName,
      existingLists.filter((existing) => existing.id !== listId && !existing.deleted),
    );
    if (nameProblem !== null) {
      return { status: "invalid-name", record: null, nameProblem };
    }
    if (trimmedName === list.name) {
      return { status: "saved", record: list, nameProblem: null };
    }

    const renamedList = changedRecord(list, { name: trimmedName }, Date.now());
    await requestToPromise(store.put(renamedList));
    return { status: "saved", record: renamedList, nameProblem: null };
  });
}

// Deletes a user-made list: marks it deleted and removes every entry linking to it, all in one transaction so a list is never
// deleted with live entries left behind. Both are kept in the database until synced (soft delete). Built-in lists, and
// lists that don't exist or are already deleted, throw (see getMutableListOrThrow). Resolves with the list as saved.
export async function deleteListInDatabase(listId: string): Promise<ListRecord> {
  const connection = await getListsConnection();
  return connection.runTransaction([LISTS_STORE, ENTRIES_STORE], "readwrite", async (tx): Promise<ListRecord> => {
    const listStore = tx.objectStore(LISTS_STORE);
    const entryStore = tx.objectStore(ENTRIES_STORE);
    const list = await getMutableListOrThrow(listStore, listId);
    const listEntries = await getEntriesOfList(entryStore, listId);

    const now = Date.now();
    const deletedList = changedRecord(list, { deleted: true }, now);
    const removedEntries = listEntries
      .filter((entry) => entry.quantity > 0)
      .map((entry) => changedRecord(entry, { quantity: 0 }, now));

    await Promise.all([requestToPromise(listStore.put(deletedList)), putAll(entryStore, removedEntries)]);
    return deletedList;
  });
}

// --- Syncing ---

// Every list and entry that has changed here and not yet been synced, deleted and removed ones included, in no
// particular order. The built-in lists are never in it: they are never changed, and every device makes its own.
export async function loadDirtyListsDataFromDatabase(): Promise<ListsData> {
  const connection = await getListsConnection();
  return connection.runTransaction([LISTS_STORE, ENTRIES_STORE], "readonly", async (tx) => {
    const lists = await getDirtyRecords<ListRecord>(tx.objectStore(LISTS_STORE));
    const entries = await getDirtyRecords<ListEntryRecord>(tx.objectStore(ENTRIES_STORE));
    return { lists, entries };
  });
}

// How many lists and entries have changed here and not yet been synced, deleted and removed ones included: the number
// the sync indicator shows.
export async function countDirtyListsDataFromDatabase(): Promise<number> {
  const connection = await getListsConnection();
  return connection.runTransaction([LISTS_STORE, ENTRIES_STORE], "readonly", async (tx) => {
    const listCount = await countDirtyRecords(tx.objectStore(LISTS_STORE));
    const entryCount = await countDirtyRecords(tx.objectStore(ENTRIES_STORE));
    return listCount + entryCount;
  });
}

// Marks lists and entries as synced once they have been uploaded. `uploaded` is what was uploaded. Each record is only
// marked if the database still holds that version of it, so one that was changed in the meantime stays dirty (see
// markRecordsSynced). Deleted lists and removed entries that were uploaded are dropped from the database: the cloud
// holds their removal now.
export async function markListsDataSyncedInDatabase(uploaded: ListsData): Promise<void> {
  const connection = await getListsConnection();
  await connection.runTransaction([LISTS_STORE, ENTRIES_STORE], "readwrite", async (tx) => {
    await Promise.all([
      markRecordsSynced(tx.objectStore(LISTS_STORE), uploaded.lists, (list) => list.deleted),
      markRecordsSynced(tx.objectStore(ENTRIES_STORE), uploaded.entries, (entry) => entry.quantity <= 0),
    ]);
  });
}

// Merges downloaded lists and entries into the database (see applyRemoteRecords: last write wins), all in one
// transaction. Resolves with the records that were applied, as saved (a deleted list or removed entry is returned but
// not stored, see applyRemoteRecords). Memory doesn't know about them yet.
export async function applyRemoteListsDataToDatabase(remote: RemoteListsData): Promise<ListsData> {
  const connection = await getListsConnection();
  return connection.runTransaction([LISTS_STORE, ENTRIES_STORE], "readwrite", async (tx): Promise<ListsData> => {
    const [lists, entries] = await Promise.all([
      applyRemoteRecords<ListRecord>(tx.objectStore(LISTS_STORE), remote.lists, (list) => list.deleted),
      applyRemoteRecords<ListEntryRecord>(
        tx.objectStore(ENTRIES_STORE),
        remote.entries,
        (entry) => entry.quantity <= 0,
      ),
    ]);
    return { lists, entries };
  });
}

// Dev tool: wipes every list and entry, then puts the built-in lists back.
export async function clearListsInDatabase(): Promise<void> {
  const connection = await getListsConnection();
  await connection.clearStores([LISTS_STORE, ENTRIES_STORE]);
  await ensureBuiltInLists(connection);
}