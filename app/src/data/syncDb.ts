import { createConnectionGetter, requestToPromise } from "./indexedDb";

// The database layer for sync bookkeeping: what this device has to remember about syncing that is not part of the lists
// or binders themselves. Nothing in this DB itself is synced: it describes this browser, not the user's data. And it
// has no memory layer: only the sync layer reads and changes it, and it reads it only around a sync. No component needs
// it live. loadSyncMetaFromDatabase only reads, so it is fine anywhere, changeSyncMetaInDatabase is for the sync layer alone.

const DB_NAME = "ygo-sync";
const DB_VERSION = 1;

const META_STORE = "meta";
const META_KEY = "sync";

// The cloud collections that are synced, under users/{uid}/. One per IndexedDB store of lists and binders.
export const SYNC_COLLECTIONS = ["lists", "listEntries", "binders", "binderCards"] as const;
export type SyncCollection = (typeof SYNC_COLLECTIONS)[number];

export interface SyncMeta {
  // The uid of the account this browser's lists and binders belong to. null until the first sync adopts the signed-in
  // account. IndexedDB belongs to the browser, not the user, so a different account must not sync into this data.
  ownerUid: string | null;
  // Per collection, the cloud's server time (in milliseconds) of the newest record the last pull received. null if the
  // collection has never been pulled, which makes the next pull a full one. A pull that starts from this time may
  // receive its newest record again, which merging handles: a record that isn't newer than the local one is skipped.
  lastPulledAt: Record<SyncCollection, number | null>;
  // When the last sync finished, by this device's clock (in milliseconds). null if there hasn't been one.
  lastSyncedAt: number | null;
}

// --- Opening the database ---

function upgradeSchema(db: IDBDatabase, oldVersion: number): void {
  // Each future schema change adds another "if (oldVersion < N)" block here.
  if (oldVersion < 1) {
    // Not a tracked store (see createTrackedStore): nothing here is synced. The key is given with each record.
    db.createObjectStore(META_STORE);
  }
}

// One shared connection for the whole app. Nothing is seeded when it opens: a database without the record reads as
// the empty meta (see readMeta).
const getSyncConnection = createConnectionGetter(DB_NAME, DB_VERSION, upgradeSchema);

// --- Reading ---

function makeEmptyMeta(): SyncMeta {
  return {
    ownerUid: null,
    lastPulledAt: { lists: null, listEntries: null, binders: null, binderCards: null },
    lastSyncedAt: null,
  };
}

// Reads the meta, or the empty meta if nothing has been saved yet. What is missing from a record saved by an earlier
// version of the app (a field, or a collection in lastPulledAt, added since) is filled in from the empty meta, so no
// migration is needed when SyncMeta grows.
async function readMeta(store: IDBObjectStore): Promise<SyncMeta> {
  const stored: SyncMeta | undefined = await requestToPromise(store.get(META_KEY));
  const empty = makeEmptyMeta();
  if (stored === undefined) {
    return empty;
  }
  return { ...empty, ...stored, lastPulledAt: { ...empty.lastPulledAt, ...stored.lastPulledAt } };
}

export async function loadSyncMetaFromDatabase(): Promise<SyncMeta> {
  const connection = await getSyncConnection();
  return connection.runTransaction([META_STORE], "readonly", (tx) => readMeta(tx.objectStore(META_STORE)));
}

// --- Operations ---

// Changes the meta inside a single transaction, so the current meta is read and the new one written with nothing able
// to write in between, even from another tab. `change` gets the current meta and returns the new one in full (e.g.
// (current) => ({ ...current, ownerUid: uid })). It has to be synchronous: awaiting anything else inside a transaction
// lets it close. Resolves with the meta as saved.
export async function changeSyncMetaInDatabase(change: (current: SyncMeta) => SyncMeta): Promise<SyncMeta> {
  const connection = await getSyncConnection();
  return connection.runTransaction([META_STORE], "readwrite", async (tx): Promise<SyncMeta> => {
    const store = tx.objectStore(META_STORE);
    const updatedMeta = change(await readMeta(store));
    await requestToPromise(store.put(updatedMeta, META_KEY));
    return updatedMeta;
  });
}