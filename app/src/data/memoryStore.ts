import { useSyncExternalStore } from "react";
import { NOT_SAVED } from "./recordConventions";
import type { RecordSaveResult } from "./recordConventions";

// The memory layer that lists.ts and binders.ts share: a copy of a database in memory, so components can read it
// synchronously, kept in step with the database and with other tabs. What the copy holds (and how a committed change is
// put into it) is up to each of the two files; everything that doesn't depend on that is here.

export interface MemoryStoreState {
  // "error": the last load or save failed. The data in the state is the last known and may be out of date, so the app is
  // read-only until a later load succeeds.
  status: "loading" | "ready" | "error";
  error: string | null;
}

// Data can only be changed once it has loaded, and not while it is in error (see MemoryStoreState.status).
// The buttons that change data are disabled otherwise, and changes that still arrive (a stale click) are refused.
export function canChangeState(state: MemoryStoreState): boolean {
  return state.status === "ready";
}

// --- Putting committed records into the state ---

// The active records after committed records have been put into memory: each committed record replaces the active record
// with the same key, if there is one, and is left out if it is no longer active (removed or deleted). The committed
// records are what the database holds now, so they replace memory's copy. The result is a new array, in no particular
// order. Nothing is written to the database here.
export function replaceActiveRecords<T>(
  activeRecords: readonly T[],
  committedRecords: readonly T[],
  getKey: (record: T) => string,
  isActive: (record: T) => boolean,
): T[] {
  const committedKeys = new Set(committedRecords.map(getKey));
  const otherRecords = activeRecords.filter((record) => !committedKeys.has(getKey(record)));
  return [...otherRecords, ...committedRecords.filter(isActive)];
}

// --- The store ---

interface MemoryStoreOptions<TState extends MemoryStoreState> {
  // What the store holds, in the plural (ex. "lists"). Used in log messages, and to name the channel the tabs use to tell
  // each other about changes.
  name: string;
  // The state before anything has loaded (status "loading").
  initialState: TState;
  // Reads everything from the database and returns the state to show (status "ready"). Throws if that fails.
  loadState: () => Promise<TState>;
  // Dev tool: wipes the database, then puts back any defaults.
  clearDatabase: () => Promise<void>;
  // How many records in the database have changed here and not yet been synced, deleted and removed ones included.
  // Throws if that fails.
  countDirtyRecords: () => Promise<number>;
}

export interface MemoryStore<TState extends MemoryStoreState> {
  getState: () => TState;
  subscribe: (listener: () => void) => () => void;
  // The current state, re-rendering the component whenever it changes.
  useLiveState: () => TState;
  // Replaces the state, for putting a committed change into memory. Only call this after the database call that made
  // the change has succeeded, and call notifyOtherTabs if something was saved.
  setState: (state: TState) => void;
  notifyOtherTabs: () => void;
  // Reads the database into memory, through the queue.
  refresh: () => Promise<void>;
  // Dev tool: wipes the database, then reloads memory from it.
  clear: () => Promise<void>;
  // How many records have changed here and not yet been synced (see MemoryStoreOptions.countDirtyRecords): what the
  // sync indicator shows. Only to be trusted while the state is "ready". It is counted from the database after every
  // load and every saved change, so changes the sync layer makes itself (marking records synced, applying remote ones)
  // show up once it calls refresh.
  getDirtyCount: () => number;
  // The number of unsynced records, re-rendering the component whenever it changes.
  useLiveDirtyCount: () => number;
  // Runs a change to the database through the queue. `change` makes the database call, puts what was saved into memory
  // and tells the other tabs; this adds what every change needs around that:
  // - Block saving while the data is loading or in error (the UI is disabled then, so this is a stale click).
  // - If the database call throws, nothing was saved and memory didn't change, so what is shown is still true. But a
  //   database that can't be written to needs attention, so stop changes and show the banner until a reload works.
  // - After a saved change, count the unsynced records again.
  enqueueChange: <TRecord>(
    failureMessage: string,
    change: () => Promise<RecordSaveResult<TRecord>>,
  ) => Promise<RecordSaveResult<TRecord>>;
}

// The database is the source of truth; the state is a copy of it in memory.
// The copy only ever changes based on reading the database (never ahead of it).
// useSyncExternalStore needs getState to return the same object until something changes, so the state is
// fully replaced (not edited) on every change.
export function createMemoryStore<TState extends MemoryStoreState>(
  options: MemoryStoreOptions<TState>,
): MemoryStore<TState> {
  let state = options.initialState;

  const listeners = new Set<() => void>();

  function setState(updatedState: TState): void {
    state = updatedState;
    listeners.forEach((listener) => listener());
  }

  // Keeps what is in memory, but marks it as no longer to be trusted.
  function setErrorState(error: unknown): void {
    const message = error instanceof Error ? error.message : "Unknown error";
    setState({ ...state, status: "error", error: message });
  }

  function getState(): TState {
    return state;
  }

  function subscribe(listener: () => void): () => void {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }

  // How components stay up to date (useSyncExternalStore is React's way of reading data that lives outside React):
  // 1. React calls subscribe once for each component using useLiveState, handing it a callback.
  // 2. Whenever setState runs, every callback is called. That only tells React "something changed".
  // 3. React then calls getState and compares the result with last time. A different object re-renders that
  //    component; the same object does nothing. That is why the state is replaced and never edited.
  function useLiveState(): TState {
    return useSyncExternalStore(subscribe, getState);
  }

  // --- The number of unsynced records ---

  // Always counted from the database, never worked out from memory: removed and deleted records are not in memory but
  // still have to be synced. Counted on every load and after every saved change. 0 until the first load.
  let dirtyCount = 0;

  function getDirtyCount(): number {
    return dirtyCount;
  }

  function setDirtyCount(count: number): void {
    if (count !== dirtyCount) {
      dirtyCount = count;
      listeners.forEach((listener) => listener());
    }
  }

  // Shares the state's listeners, so a component that only uses useLiveState is called when the count changes too. It
  // doesn't re-render, as its state is still the same object.
  function useLiveDirtyCount(): number {
    return useSyncExternalStore(subscribe, getDirtyCount);
  }

  // Everything that touches the database goes through this queue, one operation at a time, and each result is
  // applied to memory before the next operation starts. So memory is always the result of the latest operation,
  // never a slow read landing on top of a newer write.
  // The queue's own value is never read, only whether the last operation has finished, hence unknown.
  let queue: Promise<unknown> = Promise.resolve();

  function enqueue<T>(operation: () => Promise<T>): Promise<T> {
    const result = queue.then(operation);
    // A failed operation must not stop the ones queued behind it.
    queue = result.catch(() => undefined);
    return result;
  }

  // --- Other tabs ---

  // Tabs tell each other if they've changed data, because IndexedDB won't.
  const channel = typeof BroadcastChannel === "undefined" ? null : new BroadcastChannel(`ygo-${options.name}`);

  function notifyOtherTabs(): void {
    if (channel !== null) {
      channel.postMessage("changed");
    }
  }

  if (channel !== null) {
    channel.onmessage = () => {
      void refresh();
    };
  }

  // Reload tabs that may be stale/sleeping and have missed notifications for ex. from other tabs.
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") {
      void refresh();
    }
  });

  // --- Loading and changing ---

  // Reads the database into memory, and counts the unsynced records. Only call this from inside the queue.
  async function loadIntoMemory(): Promise<void> {
    try {
      const loadedState = await options.loadState();
      const loadedDirtyCount = await options.countDirtyRecords();
      setDirtyCount(loadedDirtyCount);
      setState(loadedState);
    } catch (error) {
      console.error(`Couldn't load ${options.name}`, error);
      setErrorState(error);
    }
  }

  // Counts the unsynced records again, after a change was saved. If counting fails the database can't be read, which is
  // the same as a failed load: the banner shows until a reload works. The change itself did happen, so it is still
  // reported as saved.
  async function updateDirtyCount(): Promise<void> {
    try {
      setDirtyCount(await options.countDirtyRecords());
    } catch (error) {
      console.error(`Couldn't count the unsynced ${options.name}`, error);
      setErrorState(error);
    }
  }

  function refresh(): Promise<void> {
    return enqueue(loadIntoMemory);
  }

  function clear(): Promise<void> {
    return enqueue(async () => {
      await options.clearDatabase();
      await loadIntoMemory();
      notifyOtherTabs();
    });
  }

  function enqueueChange<TRecord>(
    failureMessage: string,
    change: () => Promise<RecordSaveResult<TRecord>>,
  ): Promise<RecordSaveResult<TRecord>> {
    return enqueue(async () => {
      if (!canChangeState(state)) {
        return NOT_SAVED;
      }
      let result: RecordSaveResult<TRecord>;
      try {
        result = await change();
      } catch (error) {
        console.error(failureMessage, error);
        setErrorState(error);
        return NOT_SAVED;
      }
      if (result.status === "saved") {
        await updateDirtyCount();
      }
      return result;
    });
  }

  return {
    getState,
    subscribe,
    useLiveState,
    getDirtyCount,
    useLiveDirtyCount,
    setState,
    notifyOtherTabs,
    refresh,
    clear,
    enqueueChange,
  };
}