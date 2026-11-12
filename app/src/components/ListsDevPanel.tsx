import { useCallback, useEffect, useState } from "react";
import { isStoragePersisted } from "../data/indexedDb";
import { clearLists } from "../data/lists";
import { loadListsFromDatabase, type ListsData } from "../data/listsDb";

// Dev-only readout of the local lists database.
export function ListsDevPanel() {
  const [data, setData] = useState<ListsData | null>(null);
  const [persisted, setPersisted] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const [newData, newPersisted] = await Promise.all([loadListsFromDatabase(), isStoragePersisted()]);
      setData(newData);
      setPersisted(newPersisted);
      setError(null);
    } catch (caught) {
      setError(String(caught));
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function handleClear() {
    if (!window.confirm("Delete all local lists and their entries?")) {
      return;
    }
    try {
      await clearLists();
    } catch (caught) {
      setError(String(caught));
    }
    await refresh();
  }

  const entryCount = data === null ? 0 : data.entries.length;
  const dirtyEntryCount = data === null ? 0 : data.entries.filter((entry) => entry.dirty === 1).length;

  return (
    <section>
      <h2>Local lists (dev)</h2>
      {error !== null ? <p className="muted">Error: {error}</p> : null}
      {data !== null ? (
        <>
          <p className="muted">Persistent storage: {persisted ? "granted" : "not granted"}</p>
          <p className="muted">
            Entries: {entryCount} ({dirtyEntryCount} unsynced)
          </p>
          <ul>
            {data.lists.map((list) => (
              <li key={list.id}>
                {list.name} ({list.id}
                {list.builtIn ? ", built in" : ""})
              </li>
            ))}
          </ul>
        </>
      ) : null}
      <button onClick={handleClear}>Clear local lists</button>
    </section>
  );
}