import { FirebaseError } from "firebase/app";
import { useSyncExternalStore } from "react";
import { getAuthState, subscribeToAuth, useLiveAuth } from "./auth";
import type { AuthState } from "./auth";
import {
  clearBinders,
  notifyOtherTabsOfBinders,
  refreshBinders,
  useLiveBindersDirtyCount,
} from "./binders";
import {
  applyRemoteBindersDataToDatabase,
  loadDirtyBindersDataFromDatabase,
  markBindersDataSyncedInDatabase,
} from "./bindersDb";
import type { BinderCardRecord, BinderRecord } from "./bindersDb";
import { clearLists, notifyOtherTabsOfLists, refreshLists, useLiveListsDirtyCount } from "./lists";
import {
  applyRemoteListsDataToDatabase,
  loadDirtyListsDataFromDatabase,
  markListsDataSyncedInDatabase,
} from "./listsDb";
import type { ListEntryRecord, ListRecord } from "./listsDb";
import type { RemoteRecord, TrackedRecord } from "./recordConventions";
import { pullDocs, pushDocs, RemoteTimeoutError } from "./remoteStore";
import type { RemoteDoc } from "./remoteStore";
import { changeSyncMetaInDatabase, loadSyncMetaFromDatabase } from "./syncDb";
import type { SyncCollection } from "./syncDb";

// The sync layer: decides what to download and upload and when, and keeps the state the sync indicator shows. It is the
// only caller of the sync-only database functions (mark...SyncedInDatabase and apply...ToDatabase), and the only one
// that changes the sync meta (syncDb.ts). Components should only ever read through useLiveSyncStatus, and act through
// syncNow, discardLocalDataAndUseAccount and resetLastPulledAt.
//
// A sync pulls first, then pushes: what the cloud changed is merged in (last write wins, per record) before this
// device's changes go up over it.

// --- What the indicator shows ---

// - "loading": Firebase hasn't said yet who is signed in.
// - "signed-out": nothing is synced, the data only lives on this device.
// - "idle": signed in and nothing is waiting to be uploaded.
// - "dirty": signed in, and `count` lists, binders, entries and cards are waiting to be uploaded.
// - "syncing": a sync is running.
// - "offline": the browser is offline, or the cloud didn't answer in time. Not an error: nothing is lost.
// - "error": the sync failed, and `message` says why. It is shown by the ErrorBanner.
// - "account-mismatch": the data on this device belongs to a different account than the one signed in, so syncing is
//   blocked until the user chooses (see AccountGuardBanner).
export type SyncStatus =
  | { kind: "loading" }
  | { kind: "signed-out" }
  | { kind: "idle"; lastSyncedAt: number | null }
  | { kind: "dirty"; count: number }
  | { kind: "syncing" }
  | { kind: "offline" }
  | { kind: "error"; message: string }
  | { kind: "account-mismatch" };

// What this layer remembers between syncs, in memory only (what has to survive a reload is in the sync meta).
interface SyncState {
  phase: "idle" | "syncing" | "offline" | "error";
  // Why the last sync failed, when phase is "error".
  error: string | null;
  // Set when a sync was refused because the data on this device belongs to another account, with the uid that tried.
  // It only counts while that account is the one signed in, so signing out or back in as the owner clears it.
  mismatch: { attemptedUid: string } | null;
  // When the last sync finished in this session, by this device's clock.
  lastSyncedAt: number | null;
}

let state: SyncState = { phase: "idle", error: null, mismatch: null, lastSyncedAt: null };
const listeners = new Set<() => void>();

function setSyncState(next: SyncState): void {
  state = next;
  for (const listener of listeners) {
    listener();
  }
}

function getSyncState(): SyncState {
  return state;
}

function subscribeToSync(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

// A new sign-in starts with a clean slate: an error or "offline" from the previous account says nothing about this one.
let lastSeenUid = getAuthState().user?.uid ?? null;
subscribeToAuth(() => {
  const uid = getAuthState().user?.uid ?? null;
  if (uid === lastSeenUid) {
    return;
  }
  lastSeenUid = uid;
  if (state.phase !== "syncing") {
    setSyncState({ ...state, phase: "idle", error: null });
  }
});

export function deriveSyncStatus(auth: AuthState, syncState: SyncState, dirtyCount: number): SyncStatus {
  if (auth.status === "loading") {
    return { kind: "loading" };
  }
  if (auth.status === "signed-out" || auth.user === null) {
    return { kind: "signed-out" };
  }
  if (syncState.phase === "syncing") {
    return { kind: "syncing" };
  }
  if (syncState.phase === "error" && syncState.error !== null) {
    return { kind: "error", message: syncState.error };
  }
  if (syncState.mismatch !== null && syncState.mismatch.attemptedUid === auth.user.uid) {
    return { kind: "account-mismatch" };
  }
  if (syncState.phase === "offline") {
    return { kind: "offline" };
  }
  if (dirtyCount > 0) {
    return { kind: "dirty", count: dirtyCount };
  }
  return { kind: "idle", lastSyncedAt: syncState.lastSyncedAt };
}

// The sync status, re-rendering the component whenever it changes (including when changes pile up or are uploaded,
// since the dirty counts are live).
export function useLiveSyncStatus(): SyncStatus {
  const auth = useLiveAuth();
  const syncState = useSyncExternalStore(subscribeToSync, getSyncState);
  const listsDirtyCount = useLiveListsDirtyCount();
  const bindersDirtyCount = useLiveBindersDirtyCount();
  return deriveSyncStatus(auth, syncState, listsDirtyCount + bindersDirtyCount);
}

// --- Turning records into documents ---

// The document for a record: the record as it is, without `dirty`, which only means something on the device it is in.
// (`syncedAt` is added when it is written, see pushDocs.)
function toRemoteDoc<T extends TrackedRecord>(id: string, record: T): RemoteDoc {
  const { dirty: _dirty, ...fields } = record;
  return { id, fields };
}

// An entry has no id of its own, its key is four parts. Firestore ids are strings that can't contain "/", so each part
// is percent-encoded (which also escapes "/" and "|") and the parts are joined with "|", so no two entries can end up
// with the same id.
export function getEntryDocId(entry: ListEntryRecord): string {
  return [entry.listId, entry.cardId, entry.printingId, entry.edition].map(encodeURIComponent).join("|");
}

// --- Pulling ---

// What a pull of one collection found, ready to apply.
interface PulledCollection<T extends TrackedRecord> {
  collection: SyncCollection;
  records: RemoteRecord<T>[];
  newestSyncedAt: number | null;
}

// The records the downloaded documents hold. The cast is the one place that trusts the cloud's data to have the shape of
// the record type: only this app writes there, and the merge reads a record's key from its fields and throws if a key
// part is missing. `updatedAt` is checked here as well, because a missing or wrong one would silently win or lose
// every merge.
function toRemoteRecords<T extends TrackedRecord>(
  collection: SyncCollection,
  docs: readonly RemoteDoc[],
): RemoteRecord<T>[] {
  return docs.map((remoteDoc) => {
    const { updatedAt } = remoteDoc.fields as { updatedAt?: unknown };
    if (typeof updatedAt !== "number") {
      throw new Error(`The cloud's "${collection}" document "${remoteDoc.id}" has no valid updatedAt`);
    }
    return remoteDoc.fields as unknown as RemoteRecord<T>;
  });
}

// Downloads what has changed in one cloud collection since this device last pulled it (all of it on the first pull, or
// after resetLastPulledAt). Nothing is stored here: see savePulledUpTo.
async function pullCollection<T extends TrackedRecord>(
  uid: string,
  collection: SyncCollection,
): Promise<PulledCollection<T>> {
  const meta = await loadSyncMetaFromDatabase();
  const pulled = await pullDocs(uid, collection, meta.lastPulledAt[collection]);
  return { collection, records: toRemoteRecords<T>(collection, pulled.docs), newestSyncedAt: pulled.newestSyncedAt };
}

// Remembers how far each collection has been pulled, so the next pull starts there. Only to be called once what was
// pulled has been applied: if this device stops in between, the same records are pulled and skipped as not newer next
// time. A collection that found nothing keeps the time it had.
async function savePulledUpTo(
  pulledCollections: readonly { collection: SyncCollection; newestSyncedAt: number | null }[],
): Promise<void> {
  await changeSyncMetaInDatabase((current) => {
    const lastPulledAt = { ...current.lastPulledAt };
    for (const { collection, newestSyncedAt } of pulledCollections) {
      if (newestSyncedAt !== null) {
        lastPulledAt[collection] = newestSyncedAt;
      }
    }
    return { ...current, lastPulledAt };
  });
}

// Download lists and list entries that have changed in the cloud and merge them into the database. Memory isn't told
// here: runSync reloads it afterwards.
async function pullRemoteLists(uid: string): Promise<void> {
  const lists = await pullCollection<ListRecord>(uid, "lists");
  const entries = await pullCollection<ListEntryRecord>(uid, "listEntries");
  if (lists.records.length > 0 || entries.records.length > 0) {
    await applyRemoteListsDataToDatabase({ lists: lists.records, entries: entries.records });
  }
  await savePulledUpTo([lists, entries]);
}

// Download binders and binder entries that have changed in the cloud and merge them into the database. Memory isn't told
// here: runSync reloads it afterwards.
async function pullRemoteBinders(uid: string): Promise<void> {
  const binders = await pullCollection<BinderRecord>(uid, "binders");
  const cards = await pullCollection<BinderCardRecord>(uid, "binderCards");
  if (binders.records.length > 0 || cards.records.length > 0) {
    await applyRemoteBindersDataToDatabase({ binders: binders.records, cards: cards.records });
  }
  await savePulledUpTo([binders, cards]);
}

// --- Pushing ---

// Uploads every list and entry that has changed here, then marks them synced. A record changed while the upload was
// running keeps its dirty flag (see markRecordsSynced), so it goes up with the next sync.
async function pushDirtyLists(uid: string): Promise<void> {
  const dirty = await loadDirtyListsDataFromDatabase();
  if (dirty.lists.length === 0 && dirty.entries.length === 0) {
    return;
  }
  await pushDocs(
    uid,
    "lists",
    dirty.lists.map((list) => toRemoteDoc(list.id, list)),
  );
  await pushDocs(
    uid,
    "listEntries",
    dirty.entries.map((entry) => toRemoteDoc(getEntryDocId(entry), entry)),
  );
  await markListsDataSyncedInDatabase(dirty);
}

// The same for binders and cards.
async function pushDirtyBinders(uid: string): Promise<void> {
  const dirty = await loadDirtyBindersDataFromDatabase();
  if (dirty.binders.length === 0 && dirty.cards.length === 0) {
    return;
  }
  await pushDocs(
    uid,
    "binders",
    dirty.binders.map((binder) => toRemoteDoc(binder.id, binder)),
  );
  await pushDocs(
    uid,
    "binderCards",
    dirty.cards.map((card) => toRemoteDoc(card.id, card)),
  );
  await markBindersDataSyncedInDatabase(dirty);
}

// --- The account guard ---

// IndexedDB belongs to the browser, not the user (see SyncMeta.ownerUid). The first sync adopts the signed-in account as
// the owner of this device's data. Afterwards only that account may sync: anyone else would upload the owner's lists
// into their own account. Resolves with whether `uid` is the owner. Adopting and checking happen in one transaction, so
// two tabs signed in as different accounts can't both win.
async function claimDevice(uid: string): Promise<boolean> {
  const meta = await changeSyncMetaInDatabase((current) =>
    current.ownerUid === null ? { ...current, ownerUid: uid } : current,
  );
  return meta.ownerUid === uid;
}

// --- Running a sync ---

function describeFailure(error: unknown): SyncState {
  const base = { mismatch: null, lastSyncedAt: state.lastSyncedAt };
  // Offline, or the connection is hanging: nothing was lost, it is just not possible right now.
  if (error instanceof RemoteTimeoutError || (error instanceof FirebaseError && error.code === "unavailable")) {
    return { ...base, phase: "offline", error: null };
  }
  if (error instanceof FirebaseError && (error.code === "permission-denied" || error.code === "unauthenticated")) {
    return {
      ...base,
      phase: "error",
      error: "The cloud refused the request. Check that you are signed in and that the Firestore rules are published.",
    };
  }
  if (error instanceof FirebaseError && error.code === "resource-exhausted") {
    return {
      ...base,
      phase: "error",
      error: "The cloud database's free daily limit has been reached. Try again after midnight Pacific time.",
    };
  }
  const reason = error instanceof Error ? error.message : String(error);
  return { ...base, phase: "error", error: reason };
}

// One sync, from start to finish. Never rejects: how it went ends up in the state.
async function runSync(): Promise<void> {
  const auth = getAuthState();
  if (auth.status !== "signed-in" || auth.user === null) {
    return;
  }
  const uid = auth.user.uid;

  // Offline, a Firestore commit doesn't fail but hangs, so don't even start.
  if (!navigator.onLine) {
    setSyncState({ ...state, phase: "offline", error: null });
    return;
  }

  setSyncState({ ...state, phase: "syncing", error: null });
  let outcome: SyncState;
  try {
    if (await claimDevice(uid)) {
      await pullRemoteLists(uid);
      await pullRemoteBinders(uid);
      await pushDirtyLists(uid);
      await pushDirtyBinders(uid);
      const now = Date.now();
      await changeSyncMetaInDatabase((current) => ({ ...current, lastSyncedAt: now }));
      outcome = { phase: "idle", error: null, mismatch: null, lastSyncedAt: now };
    } else {
      outcome = { ...state, phase: "idle", error: null, mismatch: { attemptedUid: uid } };
    }
  } catch (error) {
    outcome = describeFailure(error);
  }

  // Merging pulled records in and marking pushed ones as synced changed the database behind memory's back: reloading
  // (even after a failure, which may have got part of the way) brings memory and the dirty counts up to date, here and
  // in the other tabs.
  await Promise.all([refreshLists(), refreshBinders()]);
  notifyOtherTabsOfLists();
  notifyOtherTabsOfBinders();
  setSyncState(outcome);
}

let runningSync: Promise<void> | null = null;

// Downloads what has changed in the cloud, then uploads everything that has changed on this device. While a sync is
// running, asking again joins it instead of starting a second one. Does nothing when signed out. It never rejects: the
// result is in useLiveSyncStatus.
export function syncNow(): Promise<void> {
  if (runningSync === null) {
    runningSync = runSync().finally(() => {
      runningSync = null;
    });
  }
  return runningSync;
}

// --- Account guard choices ---

// For "account-mismatch": throws this device's lists and binders away and makes the signed-in account their owner, then
// syncs, so the account's own data comes down. Whatever was only on this device is lost, so the caller has to have
// asked the user first.
//
// The data goes first and the owner second: if this stops halfway, the device is empty but still belongs to the old
// account, so the guard just asks again. The other way round would leave the old account's lists on a device that
// belongs to the new one, and upload them to it.
export async function discardLocalDataAndUseAccount(): Promise<void> {
  await runningSync;
  const auth = getAuthState();
  if (auth.status !== "signed-in" || auth.user === null) {
    return;
  }
  const uid = auth.user.uid;

  setSyncState({ ...state, phase: "syncing", error: null });
  try {
    await clearLists();
    await clearBinders();
    await changeSyncMetaInDatabase(() => ({
      ownerUid: uid,
      lastPulledAt: { lists: null, listEntries: null, binders: null, binderCards: null },
      lastSyncedAt: null,
    }));
    // No need to tell the other tabs: clearLists and clearBinders already did.
    setSyncState({ phase: "idle", error: null, mismatch: null, lastSyncedAt: null });
  } catch (error) {
    setSyncState({ ...describeFailure(error), mismatch: state.mismatch });
    return;
  }
  // The point of choosing this account is having its data here, and the device is empty now, so pull it straight away
  // (lastPulledAt was reset above, so this is a full pull) rather than leave the indicator saying "Synced" over nothing.
  await syncNow();
}

// Forgets when the given collections were last pulled, so that the next pull of them is a full one. Needed whenever the
// local data of a collection is wiped on purpose (the dev panel's clear), since a delta pull would skip every record
// the wipe took out.
export async function resetLastPulledAt(collections: readonly SyncCollection[]): Promise<void> {
  await changeSyncMetaInDatabase((current) => {
    const lastPulledAt = { ...current.lastPulledAt };
    for (const collection of collections) {
      lastPulledAt[collection] = null;
    }
    return { ...current, lastPulledAt };
  });
}