import { useCallback, useEffect, useState } from "react";
import { isStoragePersisted } from "../data/indexedDb";
import { clearLists, getListsSummary, type ListsSummary } from "../data/listsDb";

// Dev-only readout of the local lists database.
export function ListsDevPanel() {
  const [summary, setSummary] = useState<ListsSummary | null>(null);
  const [persisted, setPersisted] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const [newSummary, newPersisted] = await Promise.all([
        getListsSummary(),
        isStoragePersisted(),
      ]);
      setSummary(newSummary);
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

  return (
    <section>
      <h2>Local lists (dev)</h2>
      {error !== null ? <p className="muted">Error: {error}</p> : null}
      {summary !== null ? (
        <>
          <p className="muted">Persistent storage: {persisted ? "granted" : "not granted"}</p>
          <p className="muted">
            Entries: {summary.entryCount} ({summary.dirtyEntryCount} unsynced)
          </p>
          <ul>
            {summary.lists.map((list) => (
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