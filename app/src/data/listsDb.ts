import { IndexedDbConnection, requestPersistentStorage, requestToPromise } from "./indexedDb";
import type { Edition } from "./types";

// The database layer. Only lists.ts may call the functions that change data (changeEntryQuantityInDatabase,
// createListInDatabase, renameListInDatabase, deleteListInDatabase, clearListsInDatabase): it keeps memory and the
// other tabs in step with the database, and a direct call would skip that. Reading with loadListsFromDatabase is
// fine anywhere (e.g. the dev panel).

const DB_NAME = "ygo-lists";
const DB_VERSION = 1;

const LISTS_STORE = "lists";
const ENTRIES_STORE = "entries";
const BY_DIRTY_INDEX = "byDirty";

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

export interface EntryRecord {
  listId: string;
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
  entries: EntryRecord[];
}

export type ListNameProblem = "empty" | "duplicate";

// What every change to the lists reports, in both layers. `status` says what happened; the other fields are only
// filled in for the statuses that need them.
// - "saved": the database now holds what was asked for. `list` is the list as saved when one was created or renamed.
// - "invalid-name": nothing was saved because the list name was refused; `nameProblem` says why. That is not a
//   failure of the database.
// - "failed": the save didn't happen (a database error, which the banner already shows, or the lists weren't ready).
//   Only lists.ts reports this; the database layer throws instead.
export interface SaveResult {
  status: "saved" | "invalid-name" | "failed";
  list: ListRecord | null;
  nameProblem: ListNameProblem | null;
}

// --- Opening the database ---

function upgradeSchema(db: IDBDatabase, oldVersion: number): void {
  // Each future schema change adds another "if (oldVersion < N)" block here.
  if (oldVersion < 1) {
    const lists = db.createObjectStore(LISTS_STORE, { keyPath: "id" });
    lists.createIndex(BY_DIRTY_INDEX, "dirty");

    const entries = db.createObjectStore(ENTRIES_STORE, {
      keyPath: ["listId", "printingId", "edition"],
    });
    entries.createIndex(BY_DIRTY_INDEX, "dirty");
  }
}

let connectionPromise: Promise<IndexedDbConnection> | null = null;

// One shared connection for the whole app. A failed open is not cached, so the next call retries.
function getListsConnection(): Promise<IndexedDbConnection> {
  if (connectionPromise === null) {
    connectionPromise = openListsConnection().catch((error) => {
      connectionPromise = null;
      throw error;
    });
  }
  return connectionPromise;
}

async function openListsConnection(): Promise<IndexedDbConnection> {
  const connection = await IndexedDbConnection.open(DB_NAME, DB_VERSION, upgradeSchema);
  try {
    await ensureBuiltInLists(connection);
  } catch (error) {
    connection.close();
    throw error;
  }
  void requestPersistentStorage();
  return connection;
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

// --- Operations ---

export async function loadListsFromDatabase(): Promise<ListsData> {
  const connection = await getListsConnection();
  return connection.runTransaction([LISTS_STORE, ENTRIES_STORE], "readonly", async (tx) => {
    const lists: ListRecord[] = await requestToPromise(tx.objectStore(LISTS_STORE).getAll());
    lists.sort((a, b) => a.order - b.order);

    const entries: EntryRecord[] = await requestToPromise(tx.objectStore(ENTRIES_STORE).getAll());

    return { lists, entries };
  });
}

function getMaxQuantity(listId: string): number {
  return listId === OWNED_LIST_ID ? Infinity : 1;
}

// Changes one entry's quantity inside a single transaction, so the current quantity is read and the new one written
// with nothing able to write in between, even from another tab (IndexedDB runs transactions that write to the same
// store one at a time, across every tab). `change` gets the current quantity (0 if the entry isn't on the list) and
// returns the new one, which is kept between 0 and the list's maximum. Below 0 is clamped quietly, because a stale
// screen can ask for it (another tab already removed the entry). Above the maximum is a mistake in the caller, so it
// is clamped too but logged, should be impossible. Resolves with the entry as saved, or null if nothing needed saving.
export async function changeEntryQuantityInDatabase(
  listId: string,
  printingId: string,
  edition: Edition,
  change: (current: number) => number,
): Promise<EntryRecord | null> {
  const connection = await getListsConnection();
  return connection.runTransaction([LISTS_STORE, ENTRIES_STORE], "readwrite", async (tx) => {
    const list: ListRecord | undefined = await requestToPromise(tx.objectStore(LISTS_STORE).get(listId));
    if (list === undefined || list.deleted) {
      throw new Error(`Can't change entries of list "${listId}": it doesn't exist or has been deleted`);
    }

    const store = tx.objectStore(ENTRIES_STORE);
    const existing: EntryRecord | undefined = await requestToPromise(store.get([listId, printingId, edition]));
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

    const entry: EntryRecord = { listId, printingId, edition, quantity, updatedAt: Date.now(), dirty: 1 };
    await requestToPromise(store.put(entry));
    return entry;
  });
}

// What is wrong with a list name, or null if it is fine. otherLists must be the lists the name has to differ from: filter
// deleted, and the list being renamed before calling.
function findListNameProblem(trimmedName: string, otherLists: readonly ListRecord[]): ListNameProblem | null {
  if (trimmedName === "") {
    return "empty";
  }
  const lowerCaseName = trimmedName.toLowerCase();
  if (otherLists.some((other) => other.name.toLowerCase() === lowerCaseName)) {
    return "duplicate";
  }
  return null;
}

// Finds a list the user may rename or delete: it must exist, not be deleted, and not be built in. Anything else is a
// mistake in the caller (the UI doesn't offer these actions) or a stale screen, so it throws.
function findMutableListOrThrow(lists: readonly ListRecord[], listId: string): ListRecord {
  const list = lists.find((other) => other.id === listId);
  if (list === undefined || list.deleted) {
    throw new Error(`List "${listId}" doesn't exist or has been deleted`);
  }
  if (list.builtIn) {
    throw new Error(`The built-in list "${list.name}" can't be renamed or deleted`);
  }
  return list;
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
    const nameProblem = findListNameProblem(
      trimmedName,
      existingLists.filter((existing) => !existing.deleted),
    );
    if (nameProblem !== null) {
      return { status: "invalid-name", list: null, nameProblem };
    }

    const now = Date.now();
    const list: ListRecord = {
      id: crypto.randomUUID(),
      name: trimmedName,
      // Counts deleted lists so an order is never reused while its tombstone is still around.
      order: existingLists.reduce((highest, existing) => Math.max(highest, existing.order), -1) + 1,
      builtIn: false,
      deleted: false,
      createdAt: now,
      updatedAt: now,
      // Unlike the seeded built-in lists, this exists on this device only, so it still has to be synced.
      dirty: 1,
    };
    await requestToPromise(store.add(list));
    return { status: "saved", list, nameProblem: null };
  });
}

// Renames a user-made list. Checked like createListInDatabase, against the other lists that are in the database right
// now. Built-in lists, and lists that don't exist or are deleted, throw (see findMutableListOrThrow). Giving the list the
// name it already has resolves as saved without writing.
export async function renameListInDatabase(listId: string, name: string): Promise<SaveResult> {
  const connection = await getListsConnection();
  return connection.runTransaction([LISTS_STORE], "readwrite", async (tx): Promise<SaveResult> => {
    const store = tx.objectStore(LISTS_STORE);
    const existingLists: ListRecord[] = await requestToPromise(store.getAll());
    const list = findMutableListOrThrow(existingLists, listId);

    const trimmedName = name.trim();
    const nameProblem = findListNameProblem(
      trimmedName,
      existingLists.filter((existing) => existing.id !== listId && !existing.deleted),
    );
    if (nameProblem !== null) {
      return { status: "invalid-name", list: null, nameProblem };
    }
    if (trimmedName === list.name) {
      return { status: "saved", list, nameProblem: null };
    }

    const renamedList: ListRecord = { ...list, name: trimmedName, updatedAt: Date.now(), dirty: 1 };
    await requestToPromise(store.put(renamedList));
    return { status: "saved", list: renamedList, nameProblem: null };
  });
}

// Deletes a user-made list: marks it deleted and removes every entry linking to it, all in one transaction so a list is never
// deleted with live entries left behind. Both are kept in the database until synced (soft delete). Built-in lists, and
// lists that don't exist or are already deleted, throw (see findMutableListOrThrow). Resolves with the list as saved.
export async function deleteListInDatabase(listId: string): Promise<ListRecord> {
  const connection = await getListsConnection();
  return connection.runTransaction([LISTS_STORE, ENTRIES_STORE], "readwrite", async (tx): Promise<ListRecord> => {
    const listStore = tx.objectStore(LISTS_STORE);
    const entryStore = tx.objectStore(ENTRIES_STORE);
    const existingLists: ListRecord[] = await requestToPromise(listStore.getAll());
    const list = findMutableListOrThrow(existingLists, listId);

    // Entry keys are arrays: [listId, printingId, edition]. IndexedDB sorts keys by comparing them element by element
    // (an array that is a prefix of another sorts first), and any array sorts after any string. So:
    // - [listId] is below every key of this list (same first element, but shorter), and
    // - [listId, []] is above every key of this list (same first element, then an array in the place where real keys
    //   have a string, arrays being sorted above strings as a rule).
    // A key of another list is decided by its first element alone, which differs from listId, so it falls outside.
    const listEntries: EntryRecord[] = await requestToPromise(
      entryStore.getAll(IDBKeyRange.bound([listId], [listId, []])),
    );

    const now = Date.now();
    const deletedList: ListRecord = { ...list, deleted: true, updatedAt: now, dirty: 1 };
    const removedEntries = listEntries
      .filter((entry) => entry.quantity > 0)
      .map((entry): EntryRecord => ({ ...entry, quantity: 0, updatedAt: now, dirty: 1 }));

    await Promise.all([
      requestToPromise(listStore.put(deletedList)),
      ...removedEntries.map((entry) => requestToPromise(entryStore.put(entry))),
    ]);
    return deletedList;
  });
}

// Dev tool: wipes every list and entry, then puts the built-in lists back.
export async function clearListsInDatabase(): Promise<void> {
  const connection = await getListsConnection();
  await connection.runTransaction([LISTS_STORE, ENTRIES_STORE], "readwrite", async (tx) => {
    await Promise.all([
      requestToPromise(tx.objectStore(LISTS_STORE).clear()),
      requestToPromise(tx.objectStore(ENTRIES_STORE).clear()),
    ]);
  });
  await ensureBuiltInLists(connection);
}