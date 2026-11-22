import {
  collection as firestoreCollection,
  doc,
  getDocsFromServer,
  limit,
  orderBy,
  query,
  serverTimestamp,
  startAfter,
  Timestamp,
  where,
  writeBatch,
} from "firebase/firestore";
import type { QueryConstraint, QueryDocumentSnapshot } from "firebase/firestore";
import { firestore } from "./firebase";
import type { SyncCollection } from "./syncDb";

// The cloud layer: the only file that calls Firestore. It knows about documents and collections under users/{uid}/,
// not about lists or binders.

// A Firestore batch holds at most 500 writes.
const MAX_BATCH_SIZE = 500;

// How many documents one query downloads at most. A pull that finds more asks for the next page after the last
// document it got.
const PULL_PAGE_SIZE = 500;

// How long a single request (one batch to write, or one page to read) may take before it is given up on. Offline, a
// Firestore commit doesn't fail, it just never finishes (the SDK queues it), so without this a sync while offline would
// hang forever.
const REQUEST_TIMEOUT_MS = 30_000;

// One document, written or read: its id within the collection, and its fields
// Local records exclude their dirty field, remote ones exclude their syncedAt
export interface RemoteDoc {
  id: string;
  fields: object;
}

// What a pull found in one collection.
export interface PulledDocs {
  docs: RemoteDoc[];
  // The newest `syncedAt` among them (server time in ms), or null if there were none. Kept as lastPulledAt for the client
  newestSyncedAt: number | null;
}

// The server didn't answer a request in time, which in practice means the connection is down or hanging. A batch may
// still go through later, which is harmless: writing the same document twice leaves the same document.
export class RemoteTimeoutError extends Error {
  constructor() {
    super("The cloud didn't respond in time");
    this.name = "RemoteTimeoutError";
  }
}

function withTimeout<T>(promise: Promise<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new RemoteTimeoutError()), REQUEST_TIMEOUT_MS);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

// Writes the documents to users/{uid}/{collection}, each replacing the document with the same id, plus `syncedAt` as
// the server's time at the moment of the write. In batches of at most MAX_BATCH_SIZE, one after the other. Resolves
// once the server has acknowledged every batch. If a batch fails, it throws, and the batches before it stay written:
// the caller marks nothing as synced, so everything is simply uploaded again next time.
export async function pushDocs(uid: string, collection: SyncCollection, docs: readonly RemoteDoc[]): Promise<void> {
  for (let start = 0; start < docs.length; start += MAX_BATCH_SIZE) {
    const batch = writeBatch(firestore);
    for (const remoteDoc of docs.slice(start, start + MAX_BATCH_SIZE)) {
      batch.set(doc(firestore, "users", uid, collection, remoteDoc.id), {
        ...remoteDoc.fields,
        syncedAt: serverTimestamp(),
      });
    }
    await withTimeout(batch.commit());
  }
}

// Reads the documents of users/{uid}/{collection} that were written at or after the `since` returned in newestSyncedAt by
// an earlier pull (or all of them if `since` is null). `syncedAt`, not `updatedAt`, so a record edited a long time ago
// but uploaded later is found. If a page fails, it throws, and the caller keeps its old lastPulledAt, so the same documents
// are simply read again next time.
export async function pullDocs(uid: string, collection: SyncCollection, since: number | null): Promise<PulledDocs> {
  const collectionRef = firestoreCollection(firestore, "users", uid, collection);
  const docs: RemoteDoc[] = [];
  let newestSyncedAt: number | null = null;
  let lastSnapshot: QueryDocumentSnapshot | null = null;
  let pageSize = 0;
  do {
    const constraints: QueryConstraint[] = [orderBy("syncedAt")];
    if (since !== null) {
      constraints.push(where("syncedAt", ">=", Timestamp.fromMillis(since)));
    }
    if (lastSnapshot !== null) {
      constraints.push(startAfter(lastSnapshot));
    }
    constraints.push(limit(PULL_PAGE_SIZE));
    const page = await withTimeout(getDocsFromServer(query(collectionRef, ...constraints)));

    for (const snapshot of page.docs) {
      const { syncedAt, ...fields } = snapshot.data();
      if (!(syncedAt instanceof Timestamp)) {
        throw new Error(`The cloud's "${collection}" document "${snapshot.id}" has no syncedAt`);
      }
      docs.push({ id: snapshot.id, fields });
      newestSyncedAt = Math.max(newestSyncedAt ?? 0, syncedAt.toMillis());
    }
    pageSize = page.docs.length;
    lastSnapshot = pageSize > 0 ? page.docs[pageSize - 1] : null;
  } while (pageSize === PULL_PAGE_SIZE);
  return { docs, newestSyncedAt };
}