import { doc, serverTimestamp, writeBatch } from "firebase/firestore";
import { firestore } from "./firebase";
import type { SyncCollection } from "./syncDb";

// The cloud layer: the only file that calls Firestore. It knows about documents and collections under users/{uid}/,
// not about lists or binders.

// A Firestore batch holds at most 500 writes.
const MAX_BATCH_SIZE = 500;

// How long a single batch may take before it is given up on. Offline, a Firestore commit doesn't fail, it just never
// finishes (the SDK queues it), so without this a sync while offline would hang forever.
const COMMIT_TIMEOUT_MS = 30_000;

// One document to write: its id within the collection, and its fields (a record excluding the `dirty` field, see RemoteRecord).
export interface RemoteDoc {
  id: string;
  fields: object;
}

// The server didn't acknowledge a batch in time, which in practice means the connection is down or hanging. The batch
// may still go through later, which is harmless: writing the same document twice leaves the same document.
export class RemoteTimeoutError extends Error {
  constructor() {
    super("The cloud didn't respond in time");
    this.name = "RemoteTimeoutError";
  }
}

function withTimeout<T>(promise: Promise<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new RemoteTimeoutError()), COMMIT_TIMEOUT_MS);
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