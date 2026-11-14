export function requestToPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// Writes every record to the store (replacing any record with the same key), all at once. Call it inside a transaction
// that includes the store.
export async function putAll(store: IDBObjectStore, records: readonly unknown[]): Promise<void> {
  await Promise.all(records.map((record) => requestToPromise(store.put(record))));
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

  // Empties the given object stores, all in one transaction.
  async clearStores(storeNames: string[]): Promise<void> {
    await this.runTransaction(storeNames, "readwrite", async (tx) => {
      await Promise.all(storeNames.map((storeName) => requestToPromise(tx.objectStore(storeName).clear())));
    });
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

// Gives a function that returns the one shared connection to a database, opened on first use, so every database has the
// same opening steps:
// 1. open it (running `upgrade` if it is new or its version was raised),
// 2. run `prepare` if there is one (e.g. adding rows every device needs); if that fails the connection is closed again,
// 3. ask the browser to keep the app's storage (see requestPersistentStorage).
// A failed open is not cached, so the next call retries.
export function createConnectionGetter(
  name: string,
  version: number,
  upgrade: (db: IDBDatabase, oldVersion: number) => void,
  prepare?: (connection: IndexedDbConnection) => Promise<void>,
): () => Promise<IndexedDbConnection> {
  let connectionPromise: Promise<IndexedDbConnection> | null = null;

  async function openConnection(): Promise<IndexedDbConnection> {
    const connection = await IndexedDbConnection.open(name, version, upgrade);
    if (prepare !== undefined) {
      try {
        await prepare(connection);
      } catch (error) {
        connection.close();
        throw error;
      }
    }
    void requestPersistentStorage();
    return connection;
  }

  return () => {
    if (connectionPromise === null) {
      connectionPromise = openConnection().catch((error) => {
        connectionPromise = null;
        throw error;
      });
    }
    return connectionPromise;
  };
}