import { requestToPromise } from "./indexedDb";

// What lists (listsDb.ts) and binders (bindersDb.ts) do the same way, so the two files differ only where the data does:
// - Tracked records: every record carries `updatedAt` and `dirty`, and every change goes through changedRecord.
// - Deleted records stay in the database as tombstones until synced, so reads must skip them (getLiveRecordOrThrow).
// - Named records (lists, binders) have unique names, an order, and report saves the same way (RecordSaveResult).

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
// or set dirty. Make sure updatedAt is always incremented at least one ms even in the case of simultaneous writes/clock
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