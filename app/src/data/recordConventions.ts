import { requestToPromise } from "./indexedDb";

// What lists (listsDb.ts) and binders (bindersDb.ts) do the same way, so the two files differ only where the data does:
// - Tracked records: every record carries `updatedAt` and `dirty`, and every change goes through changedRecord.
// - Deleted records stay in the database as tombstones until synced, so reads must skip them (getLiveRecordOrThrow).
// - Named records (lists, binders) have unique names, an order, and report saves the same way (RecordSaveResult).
// - Syncing: the dirty records are read, marked as synced and merged with the cloud's copies the same way
//   (getDirtyRecords, markRecordsSynced, applyRemoteRecords).

const BY_DIRTY_INDEX = "byDirty";

export interface TrackedRecord {
  updatedAt: number;
  // Not a boolean because IndexedDB can't index booleans. 1 = changed here and not yet synced to permanent storage.
  dirty: number;
}

// Creates an object store with the "byDirty" index every tracked record store has, and returns it so the caller can
// add its own indexes. Only call this from an upgrade function.
export function createTrackedStore(db: IDBDatabase, storeName: string, keyPath: string | string[]): IDBObjectStore {
  const store = db.createObjectStore(storeName, { keyPath });
  store.createIndex(BY_DIRTY_INDEX, "dirty");
  return store;
}

// A copy of the record with the changes applied, marked as changed at `now`. Every change to a stored record goes
// through here (pass the same `now` when one operation changes several records), so none can forget to move updatedAt
// or set dirty. Makes sure updatedAt is always incremented at least one ms even in the case of simultaneous writes/clock
// errors, so that a new version of record is guaranteed to have its own unique updatedAt, used for sync.
export function changedRecord<T extends TrackedRecord>(record: T, changes: Partial<T>, now: number): T {
  return { ...record, ...changes, updatedAt: Math.max(now, record.updatedAt + 1), dirty: 1 };
}

// Reads a record that has not been deleted. A record that is missing or deleted is a mistake in the caller or a stale
// screen, so it throws. `description` names the record in the message, e.g. `List "abc"`.
export async function getLiveRecordOrThrow<T extends { deleted: boolean }>(
  store: IDBObjectStore,
  key: IDBValidKey,
  description: string,
): Promise<T> {
  const record: T | undefined = await requestToPromise(store.get(key));
  if (record === undefined || record.deleted) {
    throw new Error(`${description} doesn't exist or has been deleted`);
  }
  return record;
}

// --- Syncing tracked records ---

// The generic halves of the sync-only functions in listsDb.ts and bindersDb.ts. Each takes an object store, and has to
// be called inside a transaction that includes it.

// A record as the cloud keeps it. `dirty` only means something on the device the record is in, so it isn't uploaded.
export type RemoteRecord<T extends TrackedRecord> = Omit<T, "dirty">;

function getKeyPart(fields: Record<string, IDBValidKey | undefined>, name: string): IDBValidKey {
  const part = fields[name];
  if (part === undefined) {
    throw new Error(`A record without "${name}" can't be found in its store`);
  }
  return part;
}

// The key a record has in the store, read from its fields through the store's key path.
function getRecordKey(store: IDBObjectStore, record: object): IDBValidKey {
  const fields = record as Record<string, IDBValidKey | undefined>;
  const keyPath = store.keyPath;
  if (keyPath === null) {
    throw new Error(`Store "${store.name}" has no key path, so its records can't be found by their fields`);
  }
  if (typeof keyPath === "string") {
    return getKeyPart(fields, keyPath);
  }
  return keyPath.map((name) => getKeyPart(fields, name));
}

// Every record in the store that has changed here and not yet been synced (deleted ones included), in no particular
// order.
export function getDirtyRecords<T extends TrackedRecord>(store: IDBObjectStore): Promise<T[]> {
  return requestToPromise(store.index(BY_DIRTY_INDEX).getAll(1));
}

// Marks records as synced, once they have been uploaded. `uploadedRecords` are the records as they were uploaded. A
// record that was uploaded as a tombstone (deleted or removed, which `isTombstone` says) is dropped from the store
// instead: the cloud holds its removal now, so there is nothing left to remember it for, and adding it back later is a
// normal add. A record is only marked or dropped if the store still holds that version of it (same updatedAt): if it
// has been changed since (or added back), it stays dirty so the newer version gets uploaded too. Records that are gone
// from the store are skipped.
export async function markRecordsSynced<T extends TrackedRecord>(
  store: IDBObjectStore,
  uploadedRecords: readonly T[],
  isTombstone: (record: T) => boolean,
): Promise<void> {
  await Promise.all(
    uploadedRecords.map(async (uploaded) => {
      const key = getRecordKey(store, uploaded);
      const current: T | undefined = await requestToPromise(store.get(key));
      if (current === undefined || current.updatedAt !== uploaded.updatedAt) {
        return;
      }
      if (isTombstone(current)) {
        await requestToPromise(store.delete(key));
      } else {
        await requestToPromise(store.put({ ...current, dirty: 0 }));
      }
    }),
  );
}

// Merges the cloud's records into the store, last write wins: a remote record is applied only if it is newer than the
// store's copy, or the store has none. So a remote record never replaces a local one that is newer or equally new,
// dirty or not, and a local change that is older than the remote one is replaced by it. An applied record is written
// as synced, since the cloud already has it, except a tombstone (`isTombstone`, as in markRecordsSynced): the cloud
// holds that one, so it is dropped from the store, and one the store never had is not stored at all. Resolves with the
// records that were applied, in the order they were given (a tombstone is returned too, though it is no longer in the
// store).
export async function applyRemoteRecords<T extends TrackedRecord>(
  store: IDBObjectStore,
  remoteRecords: readonly RemoteRecord<T>[],
  isTombstone: (record: T) => boolean,
): Promise<T[]> {
  // One slot per remote record, filled in as each is handled, so the order doesn't depend on which finishes first.
  const appliedRecords: (T | null)[] = remoteRecords.map(() => null);
  await Promise.all(
    remoteRecords.map(async (remote, index) => {
      const key = getRecordKey(store, remote);
      const local: T | undefined = await requestToPromise(store.get(key));
      if (local !== undefined && remote.updatedAt <= local.updatedAt) {
        return;
      }
      // TypeScript can't see that a T without `dirty`, plus `dirty`, is a T again.
      const applied = { ...remote, dirty: 0 } as unknown as T;
      if (!isTombstone(applied)) {
        await requestToPromise(store.put(applied));
      } else if (local !== undefined) {
        await requestToPromise(store.delete(key));
      } else {
        return;
      }
      appliedRecords[index] = applied;
    }),
  );
  return appliedRecords.filter((record): record is T => record !== null);
}

// The id of every new record (and every binder page). crypto.randomUUID only exists in a secure context, so this is the
// one place to change if ids ever have to be made some other way.
export function makeRecordId(): string {
  return crypto.randomUUID();
}

// --- Named, ordered records (lists, binders) ---

export type NameProblem = "empty" | "duplicate";

// What is wrong with a name, or null if it is fine. otherRecords must be the records the name has to differ from:
// filter out deleted ones (a deleted record no longer holds its name) and the record being renamed before calling.
export function findNameProblem(trimmedName: string, otherRecords: readonly { name: string }[]): NameProblem | null {
  if (trimmedName === "") {
    return "empty";
  }
  const lowerCaseName = trimmedName.toLowerCase();
  if (otherRecords.some((other) => other.name.toLowerCase() === lowerCaseName)) {
    return "duplicate";
  }
  return null;
}

// The order for a new record, after every existing one. `existingRecords` must include deleted ones, so an order is
// never reused while its tombstone is still around.
export function getNextOrder(existingRecords: readonly { order: number }[]): number {
  return existingRecords.reduce((highest, existing) => Math.max(highest, existing.order), -1) + 1;
}

export function compareByOrder(a: { order: number }, b: { order: number }): number {
  return a.order - b.order;
}

// What every change to a kind of named record reports, in both layers. `status` says what happened; the other fields
// are only filled in for the statuses that need them.
// - "saved": the database now holds what was asked for. `record` is the record as saved when one was created or
//   renamed.
// - "invalid-name": nothing was saved because the name was refused; `nameProblem` says why. That is not a failure of
//   the database.
// - "failed": the save didn't happen (a database error, which the banner already shows, or the data wasn't ready).
//   Only the layer that keeps memory (lists.ts, binders.ts) reports this; the database layer throws instead.
export interface RecordSaveResult<TRecord> {
  status: "saved" | "invalid-name" | "failed";
  record: TRecord | null;
  nameProblem: NameProblem | null;
}

// For the layer that keeps memory: a change that didn't happen.
export const NOT_SAVED: RecordSaveResult<never> = { status: "failed", record: null, nameProblem: null };

// For the layer that keeps memory: a change that was saved but has no record to report (anything except creating or
// renaming a named record).
export const SAVED_WITHOUT_RECORD: RecordSaveResult<never> = { status: "saved", record: null, nameProblem: null };