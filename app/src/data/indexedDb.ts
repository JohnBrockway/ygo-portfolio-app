export function requestToPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function transactionDone(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

// An open connection to one IndexedDB database.
export class IndexedDbConnection {
  private readonly db: IDBDatabase;

  private constructor(db: IDBDatabase) {
    this.db = db;
  }

  // `upgrade` runs when the database is first created or its version is raised.
  // It is where the caller creates or changes its object stores.
  static open(
    name: string,
    version: number,
    upgrade: (db: IDBDatabase, oldVersion: number) => void,
  ): Promise<IndexedDbConnection> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(name, version);
      request.onupgradeneeded = (event) => upgrade(request.result, event.oldVersion);
      request.onsuccess = () => resolve(new IndexedDbConnection(request.result));
      request.onerror = () => reject(request.error);
    });
  }

  // Runs `work` inside one transaction and resolves once the transaction has committed.
  // Only await IndexedDB requests inside `work`: awaiting anything else lets the transaction close.
  async runTransaction<T>(
    storeNames: string[],
    mode: IDBTransactionMode,
    work: (tx: IDBTransaction) => Promise<T>,
  ): Promise<T> {
    const tx = this.db.transaction(storeNames, mode);
    const done = transactionDone(tx);
    try {
      const result = await work(tx);
      await done;
      return result;
    } catch (error) {
      // If the transaction aborted, `done` rejects too; this keeps that from being reported twice.
      done.catch(() => undefined);
      throw error;
    }
  }

  close(): void {
    this.db.close();
  }
}

export async function requestPersistentStorage(): Promise<boolean> {
  if (!navigator.storage || !navigator.storage.persist) {
    return false;
  }
  return navigator.storage.persist();
}

export async function isStoragePersisted(): Promise<boolean> {
  if (!navigator.storage || !navigator.storage.persisted) {
    return false;
  }
  return navigator.storage.persisted();
}