import type { Edition } from "./types";
import { IndexedDbConnection, requestPersistentStorage, requestToPromise } from "./indexedDb";

// The database layer. Only lists.ts may call the functions that change data (changeEntryQuantityInDatabase,
// clearListsInDatabase): it keeps memory and the other tabs in step with the database, and a direct call
// would skip that. Reading with loadListsFromDatabase is fine anywhere (e.g. the dev panel).

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

// Everything on disk, for loading into memory.
export interface ListsData {
  lists: ListRecord[];
  entries: EntryRecord[];
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

// Changes one entry's quantity inside a single transaction, so the current quantity is read and the new one written
// with nothing able to write in between, even from another tab (IndexedDB runs transactions that write to the same
// store one at a time, across every tab). `change` gets the current quantity (0 if the entry isn't on the list) and
// returns the new one. Resolves with the entry as saved, or null if nothing needed saving.
export async function changeEntryQuantityInDatabase(
  listId: string,
  printingId: string,
  edition: Edition,
  change: (current: number) => number,
): Promise<EntryRecord | null> {
  const connection = await getListsConnection();
  return connection.runTransaction([ENTRIES_STORE], "readwrite", async (tx) => {
    const store = tx.objectStore(ENTRIES_STORE);
    const existing: EntryRecord | undefined = await requestToPromise(store.get([listId, printingId, edition]));
    const current = existing === undefined ? 0 : existing.quantity;

    const quantity = Math.max(change(current), 0);
    if (quantity === current) {
      return null;
    }

    const entry: EntryRecord = { listId, printingId, edition, quantity, updatedAt: Date.now(), dirty: 1 };
    await requestToPromise(store.put(entry));
    return entry;
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